"use client";

import { useSyncExternalStore } from "react";
import type { AssistantHighlight, AssistantMessage, AssistantReply } from "../assistant-types";

type AssistantState = {
  messages: AssistantMessage[];
  isThinking: boolean;
  /** The last answer's components lit up on the ship, until cleared or the next answer. */
  highlights: AssistantHighlight[];
  /** The last answer: its evidence and citations, for the strip under the scene. */
  latestReply: AssistantReply | null;
  /** A question asked from elsewhere (the log's "Ask about this"), for the panel to send when it opens. */
  pendingQuestion: string | null;
};

const INITIAL_STATE: AssistantState = { messages: [], isThinking: false, highlights: [], latestReply: null, pendingQuestion: null };

let state = INITIAL_STATE;
const listeners = new Set<() => void>();
let nextId = 0;

function update(change: Partial<AssistantState>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getState = () => state;
const getServerState = () => INITIAL_STATE;

/**
 * The ship assistant's conversation, shared by its panel, the highlights on
 * the ship and the evidence strip. The operator's, in this browser only.
 */
export function useAssistantState(): AssistantState {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

export const newMessageId = () => `message-${++nextId}`;

/** Asks the assistant from elsewhere: the panel sends it as it opens. */
export function askAssistant(question: string) {
  update({ pendingQuestion: question });
}

/** The question waiting to be sent, taken: it is sent once. */
export function takePendingQuestion() {
  const question = state.pendingQuestion;
  if (question) update({ pendingQuestion: null });
  return question;
}

export function addUserMessage(content: string) {
  update({ messages: [...state.messages, { id: newMessageId(), role: "user", content }], isThinking: true });
}

export function addAssistantReply(reply: AssistantReply) {
  update({
    messages: [...state.messages, { id: newMessageId(), role: "assistant", content: reply.answer, reply }],
    isThinking: false,
    highlights: reply.highlights,
    latestReply: reply,
  });
}

export function addAssistantError(content: string) {
  update({ messages: [...state.messages, { id: newMessageId(), role: "error", content }], isThinking: false });
}

export function clearHighlights() {
  update({ highlights: [] });
}

/** A new conversation: the old one, its highlights and evidence gone. */
export function startNewConversation() {
  update({ ...INITIAL_STATE });
}
