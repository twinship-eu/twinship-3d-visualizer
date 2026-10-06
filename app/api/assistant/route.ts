import {
  ASSISTANT_NUM_CTX,
  ASSISTANT_TEMPERATURE,
  ASSISTANT_TIMEOUT_MS,
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_OLLAMA_CHAT_URL,
} from "@/features/assistant/assistant-config";
import type { AssistantRequest } from "@/features/assistant/assistant-types";
import { ASSISTANT_SYSTEM_PROMPT } from "@/features/assistant/lib/assistant-prompt";

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

const failure = (status: number, error: string) => Response.json({ error }, { status });

/** What the model is asked when its JSON came without the answer. */
const ANSWER_IN_WORDS = "Now give only the answer to my question, in words: 1-3 short sentences, plain text, no JSON.";

/**
 * The ship assistant's model, behind the viewer: the conversation and the
 * ship's data in, the model's reply out. Server side, so the endpoint can be
 * one the browser cannot reach, and the page stays on https.
 */
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** One call to the model; its reply's text, or why there is none. */
async function chat(messages: ChatMessage[], isJson: boolean): Promise<{ content: string } | { error: Response }> {
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
    const reason = error instanceof Error && error.name === "TimeoutError" ? "did not answer in time" : "could not be reached";
    console.error(`Ship assistant: the model at ${OLLAMA_CHAT_URL} ${reason}.`, error);
    return { error: failure(502, `The assistant's model ${reason} (${new URL(OLLAMA_CHAT_URL).host}).`) };
  }
  if (response.status === 401 || response.status === 403) {
    console.error(`Ship assistant: the model refused the key (${response.status}).`);
    return {
      error: failure(
        502,
        OLLAMA_API_KEY ? "The assistant's model refused its key: check OLLAMA_API_KEY." : "The assistant's model needs a key: set OLLAMA_API_KEY in .env.local."
      ),
    };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Ship assistant: the model answered ${response.status}.`, detail);
    return { error: failure(502, `The assistant's model answered ${response.status}${detail.includes("not found") ? `: ${ASSISTANT_MODEL} is not on the server (set ASSISTANT_MODEL)` : ""}.`) };
  }
  const data = (await response.json()) as OllamaChatResponse;
  const content = data.message?.content ?? data.response;
  if (data.error || typeof content !== "string" || !content.trim()) {
    return { error: failure(502, data.error ?? "The assistant's model returned an empty reply.") };
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
  const body: unknown = await request.json().catch(() => null);
  if (!isAssistantRequest(body)) return failure(400, "Expected { messages, context }.");

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
