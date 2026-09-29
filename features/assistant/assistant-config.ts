/**
 * The ship assistant: an LLM answering from the ship's data — its live
 * readings, event log and knowledge graph — through the same Ollama API the
 * weather router's voyage assistant uses.
 */

/** The viewer's own route to the model: the browser never calls the LLM itself. */
export const ASSISTANT_ROUTE = "/api/assistant";

/**
 * The Ollama chat endpoint and model, server side. The weather router's by
 * default (NTUA's server: reachable over its VPN); override with
 * OLLAMA_CHAT_URL and ASSISTANT_MODEL.
 */
export const DEFAULT_OLLAMA_CHAT_URL = "http://ugpu.epu.ntua.gr:11434/api/chat";
export const DEFAULT_ASSISTANT_MODEL = "mistral:7b-instruct";
export const ASSISTANT_TEMPERATURE = 0.1;
/** The prompt carries the ship's data every turn: Ollama's default 2048 tokens would cut it. */
export const ASSISTANT_NUM_CTX = 8192;
/** How long to wait for an answer, in ms. */
export const ASSISTANT_TIMEOUT_MS = 90_000;

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
