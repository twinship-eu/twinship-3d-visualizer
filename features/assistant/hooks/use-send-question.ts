"use client";

import { useCallback } from "react";
import { useEventLog } from "@/features/event-log/hooks/use-event-log";
import { HISTORY_TURNS } from "../assistant-config";
import type { AssistantMessage } from "../assistant-types";
import { addAssistantError, addAssistantReply, addUserMessage, useAssistantState } from "../lib/assistant-store";
import { buildAssistantContext } from "../lib/build-assistant-context";
import { parseAssistantReply } from "../lib/parse-assistant-reply";
import { useAssistantMutation } from "../queries/use-assistant-mutation";

/** The conversation's last turns, for the model: errors left out, the data being in the prompt anyway. */
function recentTurns(messages: AssistantMessage[]) {
  return messages
    .filter((message) => message.role !== "error")
    .slice(-HISTORY_TURNS)
    .map((message) => ({ role: message.role === "user" ? ("user" as const) : ("assistant" as const), content: message.content }));
}

/**
 * Sends the operator's question with the ship's data as it is now — the
 * readings, the event log, the knowledge graph — and adds the checked answer
 * to the conversation.
 */
export function useSendQuestion() {
  const { events, history } = useEventLog();
  const { messages, isThinking } = useAssistantState();
  const { askModel } = useAssistantMutation();

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || isThinking) return;
      const turns = [...recentTurns(messages), { role: "user" as const, content: text }];
      addUserMessage(text);
      try {
        const content = await askModel({ messages: turns, context: buildAssistantContext(history, events) });
        addAssistantReply(parseAssistantReply(content, new Set(events.map((event) => event.number))));
      } catch (error) {
        addAssistantError(error instanceof Error ? error.message : "The assistant could not answer.");
      }
    },
    [askModel, events, history, isThinking, messages]
  );

  return { send, isThinking };
}
