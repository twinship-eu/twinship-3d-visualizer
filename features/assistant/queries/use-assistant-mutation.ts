"use client";

import useSWRMutation from "swr/mutation";
import { ASSISTANT_ROUTE } from "../assistant-config";
import type { AssistantRequest } from "../assistant-types";

/** Posts a question and the ship's data to the assistant's route; the model's raw reply back. */
async function askModel(url: string, { arg }: { arg: AssistantRequest }): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const data = (await response.json().catch(() => ({}))) as { content?: string; error?: string };
  if (!response.ok || typeof data.content !== "string") {
    throw new Error(data.error ?? `The assistant could not answer (${response.status}).`);
  }
  return data.content;
}

/** The ship assistant's model, as a mutation: one question, one answer. */
export function useAssistantMutation() {
  const { trigger, isMutating } = useSWRMutation(ASSISTANT_ROUTE, askModel);
  return { askModel: trigger, isAsking: isMutating };
}
