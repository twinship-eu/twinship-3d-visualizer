import { SENSORS } from "@/features/live-data/live-data-sensors";
import { MAX_HIGHLIGHTS } from "../assistant-config";
import type { AssistantReply } from "../assistant-types";
import { HIGHLIGHTABLE_COMPONENTS } from "./build-assistant-context";

/** The JSON object in a reply: fences and stray prose round it stripped, as small models add them. */
function jsonIn(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * The model's reply, checked against the data: highlights only of components
 * the ship has, citations only of events the log holds, evidence only from a
 * sensor it knows. Not JSON, the text itself is the answer, with nothing to
 * light up.
 */
export function parseAssistantReply(text: string, eventNumbers: Set<number>): AssistantReply {
  const parsed = jsonIn(text);
  if (!isRecord(parsed) || typeof parsed.answer !== "string" || !parsed.answer.trim()) {
    return { answer: text.trim(), highlights: [], citedEvents: [], evidenceSensor: null };
  }

  const componentByName = new Map(HIGHLIGHTABLE_COMPONENTS.map((component) => [component.toLowerCase(), component]));
  const highlights = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
    .filter(isRecord)
    .flatMap((highlight) => {
      const component = typeof highlight.component === "string" ? componentByName.get(highlight.component.trim().toLowerCase()) : undefined;
      return component ? [{ component, note: typeof highlight.note === "string" ? highlight.note.trim() : "" }] : [];
    })
    .filter((highlight, index, all) => all.findIndex((other) => other.component === highlight.component) === index)
    .slice(0, MAX_HIGHLIGHTS);
  const citedEvents = (Array.isArray(parsed.citedEvents) ? parsed.citedEvents : [])
    .map((number) => Number(number))
    .filter((number) => eventNumbers.has(number));
  const sensorIds = new Set(SENSORS.map((sensor) => sensor.id));
  const evidenceSensor =
    typeof parsed.evidenceSensor === "string" && sensorIds.has(parsed.evidenceSensor.trim().toUpperCase())
      ? parsed.evidenceSensor.trim().toUpperCase()
      : null;

  return { answer: parsed.answer.trim(), highlights, citedEvents: [...new Set(citedEvents)], evidenceSensor };
}
