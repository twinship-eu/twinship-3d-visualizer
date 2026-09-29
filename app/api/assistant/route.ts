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

/**
 * The ship assistant's model, behind the viewer: the conversation and the
 * ship's data in, the model's reply out. Server side, so the endpoint can be
 * one the browser cannot reach, and the page stays on https.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isAssistantRequest(body)) return failure(400, "Expected { messages, context }.");

  let response: Response;
  try {
    response = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        messages: [{ role: "system", content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${body.context}` }, ...body.messages],
        options: { temperature: ASSISTANT_TEMPERATURE, num_ctx: ASSISTANT_NUM_CTX },
        format: "json",
        stream: false,
      }),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "did not answer in time" : "could not be reached";
    console.error(`Ship assistant: the model at ${OLLAMA_CHAT_URL} ${reason}.`, error);
    return failure(502, `The assistant's model ${reason} (${new URL(OLLAMA_CHAT_URL).host}).`);
  }

  if (!response.ok) {
    console.error(`Ship assistant: the model answered ${response.status}.`, await response.text().catch(() => ""));
    return failure(502, `The assistant's model answered ${response.status}.`);
  }
  const data = (await response.json()) as OllamaChatResponse;
  const content = data.message?.content ?? data.response;
  if (data.error || typeof content !== "string" || !content.trim()) {
    return failure(502, data.error ?? "The assistant's model returned an empty reply.");
  }
  return Response.json({ content });
}
