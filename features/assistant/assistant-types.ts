/** A component the assistant points at on the ship, and why, in a few words. */
export type AssistantHighlight = { component: string; note: string };

/** What the model answers, checked against the data: only components, events and sensors that exist. */
export type AssistantReply = {
  /** The answer, in markdown. */
  answer: string;
  highlights: AssistantHighlight[];
  /** The event log's entries it rests on, by number. */
  citedEvents: number[];
  /** The sensor whose trend is its evidence, by id; null when none. */
  evidenceSensor: string | null;
};

export type AssistantMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; reply: AssistantReply }
  | { id: string; role: "error"; content: string };

/** What the viewer sends its route: the conversation, and the ship's data as the model's context. */
export type AssistantRequest = {
  messages: { role: "user" | "assistant"; content: string }[];
  context: string;
};
