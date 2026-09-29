"use client";

import { useKeptHistory, useOperatorActions } from "@/features/live-data/hooks/use-live-data";
import type { LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import type { LogEvent } from "../event-log-types";
import { buildEventLog } from "../lib/build-event-log";

/** The last log built, and what from: every reader shares it, built once a snapshot. */
let cached: { history: LiveSnapshot[]; actions: OperatorAction[]; events: LogEvent[] } | null = null;

function eventLogOf(history: LiveSnapshot[], actions: OperatorAction[]) {
  if (cached?.history !== history || cached.actions !== actions) {
    cached = { history, actions, events: buildEventLog(history, actions) };
  }
  return cached.events;
}

/** The event log, newest first, and the history it is read from: rebuilt with each snapshot. */
export function useEventLog() {
  const history = useKeptHistory();
  const actions = useOperatorActions();
  return { events: eventLogOf(history, actions), history, actions };
}
