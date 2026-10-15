import {
  ASSISTANT_NUM_CTX,
  ASSISTANT_RATE_LIMITS,
  ASSISTANT_REQUEST_LIMITS,
  ASSISTANT_RETRIES,
  ASSISTANT_RETRY_DELAY_MS,
  ASSISTANT_TEMPERATURE,
  ASSISTANT_TIMEOUT_MS,
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_OLLAMA_CHAT_URL,
  HISTORY_TURNS,
} from "@/features/assistant/assistant-config";
import type { AssistantRequest } from "@/features/assistant/assistant-types";
import { ASSISTANT_SYSTEM_PROMPT } from "@/features/assistant/lib/assistant-prompt";
import { clientAddress, createRateLimiter } from "@/features/assistant/lib/rate-limit";

/** Ollama's /api/chat reply, the parts read. */
type OllamaChatResponse = { message?: { content?: string }; response?: string; error?: string };

const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL ?? process.env.NEXT_PUBLIC_OLLAMA_CHAT_URL ?? DEFAULT_OLLAMA_CHAT_URL;
const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL ?? DEFAULT_ASSISTANT_MODEL;
/** The Ollama endpoint's bearer key, server side only: never sent to the browser. */
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

function isAssistantRequest(body: unknown): body is AssistantRequest {
  if (typeof body !== "object" || body === null) return false;
  const { messages, context } = body as Partial<AssistantRequest>;
  return (
    typeof context === "string" &&
    Array.isArray(messages) &&
    messages.every((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
  );
}

/** Why a request carries more than the viewer ever sends, or null when it does not. */
function oversized({ messages, context }: AssistantRequest): string | null {
  const { CONTEXT_CHARS, QUESTION_CHARS, ANSWER_CHARS } = ASSISTANT_REQUEST_LIMITS;
  // The turns kept, and the question
  if (messages.length > HISTORY_TURNS + 1) return "Too many turns of conversation.";
  if (context.length > CONTEXT_CHARS) return "The ship's data is too long.";
  const isTooLong = (message: AssistantRequest["messages"][number]) =>
    message.content.length > (message.role === "user" ? QUESTION_CHARS : ANSWER_CHARS);
  if (messages.some(isTooLong)) return `A question may be at most ${QUESTION_CHARS} characters.`;
  return null;
}

/** Questions per computer, a minute and a day. */
const perClient = createRateLimiter([ASSISTANT_RATE_LIMITS.PER_CLIENT_PER_MINUTE, ASSISTANT_RATE_LIMITS.PER_CLIENT_PER_DAY]);
/** Questions from everyone together, a day. */
const allClients = createRateLimiter([ASSISTANT_RATE_LIMITS.ALL_CLIENTS_PER_DAY]);
const ALL_CLIENTS_KEY = "all";

/** "Try again in 40 s", or in minutes or hours when it is that long. */
function waitFor(seconds: number) {
  if (seconds < 120) return `${seconds} s`;
  if (seconds < 2 * 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)} h`;
}

const tooMany = (retryAfterS: number, error: string) =>
  Response.json({ error: `${error} Try again in ${waitFor(retryAfterS)}.` }, { status: 429, headers: { "Retry-After": String(retryAfterS) } });

/** The request's limits: its size, then this computer's questions, then everyone's. A response when one is exceeded. */
async function checkLimits(request: Request): Promise<{ body: AssistantRequest } | { error: Response }> {
  const length = Number(request.headers.get("content-length"));
  if (length > ASSISTANT_REQUEST_LIMITS.BODY_BYTES) return { error: failure(413, "The request is too large.") };
  const text = await request.text();
  if (text.length > ASSISTANT_REQUEST_LIMITS.BODY_BYTES) return { error: failure(413, "The request is too large.") };

  const body: unknown = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  if (!isAssistantRequest(body)) return { error: failure(400, "Expected { messages, context }.") };
  const tooLarge = oversized(body);
  if (tooLarge) return { error: failure(413, tooLarge) };

  const address = clientAddress(request);
  const client = perClient.take(address);
  if (!client.isAllowed) {
    console.warn(`Ship assistant: ${address} is over its limit of questions.`);
    return { error: tooMany(client.retryAfterS, "Too many questions from this computer.") };
  }
  const everyone = allClients.take(ALL_CLIENTS_KEY);
  if (!everyone.isAllowed) {
    console.warn("Ship assistant: today's questions for everyone are used up.");
    return { error: tooMany(everyone.retryAfterS, "The assistant has answered all the questions it can today.") };
  }
  return { body };
}

const failure = (status: number, error: string) => Response.json({ error }, { status });

/** What the model is asked when its JSON came without the answer. */
const ANSWER_IN_WORDS = "Now give only the answer to my question, in words: 1-3 short sentences, plain text, no JSON.";

/**
 * The ship assistant's model, behind the viewer: the conversation and the
 * ship's data in, the model's reply out. Server side, so the endpoint can be
 * one the browser cannot reach, and the page stays on https.
 */
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** A call's outcome: the reply's text, or why there is none — and whether trying again may help. */
type ChatResult = { content: string } | { error: Response; isTransient: boolean };

/** Upstream statuses that pass: the server busy, restarting, or behind a proxy that timed out. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A call to the model, tried again while it fails in a way that passes. */
async function chat(messages: ChatMessage[], isJson: boolean): Promise<{ content: string } | { error: Response }> {
  for (let attempt = 0; ; attempt++) {
    const result = await chatOnce(messages, isJson);
    if (!("error" in result) || !result.isTransient || attempt >= ASSISTANT_RETRIES) return result;
    console.warn(`Ship assistant: the model failed for a moment; trying again (${attempt + 1} of ${ASSISTANT_RETRIES}).`);
    await wait(ASSISTANT_RETRY_DELAY_MS * (attempt + 1));
  }
}

/** One call to the model; its reply's text, or why there is none. */
async function chatOnce(messages: ChatMessage[], isJson: boolean): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {}),
      },
      signal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        messages,
        options: { temperature: ASSISTANT_TEMPERATURE, num_ctx: ASSISTANT_NUM_CTX },
        ...(isJson ? { format: "json" } : {}),
        stream: false,
      }),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    const reason = isTimeout ? "did not answer in time" : "could not be reached";
    console.error(`Ship assistant: the model at ${OLLAMA_CHAT_URL} ${reason}.`, error);
    // Unreachable for a moment is worth another try; a whole timeout again would keep the operator waiting minutes
    return { error: failure(502, `The assistant's model ${reason} (${new URL(OLLAMA_CHAT_URL).host}).`), isTransient: !isTimeout };
  }
  if (response.status === 401 || response.status === 403) {
    console.error(`Ship assistant: the model refused the key (${response.status}).`);
    return {
      error: failure(
        502,
        OLLAMA_API_KEY ? "The assistant's model refused its key: check OLLAMA_API_KEY." : "The assistant's model needs a key: set OLLAMA_API_KEY in .env.local."
      ),
      isTransient: false,
    };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Ship assistant: the model answered ${response.status}.`, detail);
    return {
      error: failure(502, `The assistant's model answered ${response.status}${detail.includes("not found") ? `: ${ASSISTANT_MODEL} is not on the server (set ASSISTANT_MODEL)` : ""}.`),
      isTransient: TRANSIENT_STATUSES.has(response.status),
    };
  }
  // A proxy's error page under a 200 is not JSON: a reply to try again, not a crash of the route
  const data = (await response.json().catch(() => null)) as OllamaChatResponse | null;
  if (!data) {
    console.error("Ship assistant: the model's reply was not JSON.");
    return { error: failure(502, "The assistant's model sent a reply that could not be read."), isTransient: true };
  }
  const content = data.message?.content ?? data.response;
  if (data.error || typeof content !== "string" || !content.trim()) {
    return { error: failure(502, data.error ?? "The assistant's model returned an empty reply."), isTransient: true };
  }
  return { content };
}

/** The reply's JSON object, if it is one. */
function replyObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1).replace(/,\s*}/g, "}"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The ship assistant's model, behind the viewer: the conversation and the
 * ship's data in, the model's reply out. Server side, so the endpoint can be
 * one the browser cannot reach, its key stays here, and the page stays on
 * https. Small models at times return the JSON without its "answer": then the
 * answer is asked for again, in words, and put in.
 */
export async function POST(request: Request) {
  // Whatever goes wrong unforeseen, the chat gets a reason, not a bare 500
  try {
    return await answer(request);
  } catch (error) {
    console.error("Ship assistant: the question could not be answered.", error);
    return failure(502, "The assistant could not answer this time: please ask again.");
  }
}

/** The question checked against the limits, asked of the model, its answer put in words when it came without. */
async function answer(request: Request) {
  const checked = await checkLimits(request);
  if ("error" in checked) return checked.error;
  const { body } = checked;

  const conversation: ChatMessage[] = [{ role: "system", content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${body.context}` }, ...body.messages];
  const first = await chat(conversation, true);
  if ("error" in first) return first.error;

  const reply = replyObject(first.content);
  if (reply && (typeof reply.answer !== "string" || !reply.answer.trim())) {
    const again = await chat([...conversation, { role: "assistant", content: first.content }, { role: "user", content: ANSWER_IN_WORDS }], false);
    if ("error" in again) return again.error;
    return Response.json({ content: JSON.stringify({ ...reply, answer: again.content.trim() }) });
  }
  return Response.json({ content: first.content });
}
