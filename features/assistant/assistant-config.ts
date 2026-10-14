/**
 * The ship assistant: an LLM answering from the ship's data — its live
 * readings, event log and knowledge graph — through the same Ollama API the
 * weather router's voyage assistant uses.
 */

/** The viewer's own route to the model: the browser never calls the LLM itself. */
export const ASSISTANT_ROUTE = "/api/assistant";

/**
 * The Ollama chat endpoint and model, server side: the project's public
 * Ollama, which takes a bearer key (OLLAMA_API_KEY in .env.local). Override
 * with OLLAMA_CHAT_URL and ASSISTANT_MODEL — NTUA's own server over its VPN
 * was http://ugpu.epu.ntua.gr:11434/api/chat.
 */
export const DEFAULT_OLLAMA_CHAT_URL = "https://ollama.vessel-ai.eu/api/chat";
/**
 * On the project server: ministral-3:8b follows the instructions (a greeting is
 * a greeting, a question about one sensor is about it); mistral:7b turned every
 * question to the active alarm. Also there: maritime-ministral3, mistral:7b.
 */
export const DEFAULT_ASSISTANT_MODEL = "ministral-3:8b";
export const ASSISTANT_TEMPERATURE = 0.1;
/** The prompt carries the ship's data every turn: Ollama's default 2048 tokens would cut it. */
export const ASSISTANT_NUM_CTX = 8192;
/** How long to wait for an answer, in ms. */
export const ASSISTANT_TIMEOUT_MS = 90_000;

/**
 * The route's limits, the site being open to anyone: questions per computer
 * (by its address) a minute and a day, and for everyone together a day — the
 * Ollama key's ceiling, whatever the addresses.
 */
export const ASSISTANT_RATE_LIMITS = {
  PER_CLIENT_PER_MINUTE: { max: 6, windowMs: 60_000 },
  PER_CLIENT_PER_DAY: { max: 60, windowMs: 24 * 60 * 60_000 },
  ALL_CLIENTS_PER_DAY: { max: 1000, windowMs: 24 * 60 * 60_000 },
} as const;

/** The most a request may carry: its body, the ship's data, a question, an earlier answer, in characters. */
export const ASSISTANT_REQUEST_LIMITS = {
  BODY_BYTES: 64_000,
  CONTEXT_CHARS: 30_000,
  QUESTION_CHARS: 1000,
  ANSWER_CHARS: 6000,
} as const;

/** Turns of the conversation sent with each question: the data is in the prompt anyway. */
export const HISTORY_TURNS = 6;
/** Event log entries in the prompt, newest first. */
export const CONTEXT_EVENTS = 30;
/** Minutes of trend summarised for the sensors in question. */
export const CONTEXT_TREND_MINUTES = 10;
/** Components one answer may highlight on the ship. */
export const MAX_HIGHLIGHTS = 5;

/** The design's suggested questions. */
export const SUGGESTED_QUESTIONS = ["Why is it happening?", "What should I do?", "Show all warnings today", "When did it start?"] as const;

export const ASSISTANT_DISCLAIMER =
  "Answers come from a language model reading the ship's data, and cite it; check safety-critical decisions with the officer on watch.";
