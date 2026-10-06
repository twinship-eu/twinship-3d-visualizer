"use client";

import { useKeptHistory, useOperatorActions, usePlayback } from "@/features/live-data/hooks/use-live-data";
import type { LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import type { LogEvent } from "../event-log-types";
import { buildEventLog } from "../lib/build-event-log";

/** The last log built, and what from: every reader shares it, built once a snapshot. */
let cached: { kept: LiveSnapshot[]; actions: OperatorAction[]; viewedAt: number | null; history: LiveSnapshot[]; events: LogEvent[] } | null =
  null;

/** The log as it stood at the moment viewed: replaying, only what had happened by then. */
function eventLogOf(kept: LiveSnapshot[], actions: OperatorAction[], viewedAt: number | null) {
  if (cached?.kept !== kept || cached.actions !== actions || cached.viewedAt !== viewedAt) {
    const history = viewedAt === null ? kept : kept.filter((snapshot) => snapshot.timestamp <= viewedAt);
    const done = viewedAt === null ? actions : actions.filter((action) => action.at <= viewedAt);
    cached = { kept, actions, viewedAt, history, events: buildEventLog(history, done) };
  }
  return cached;
}

/** The event log, newest first, and the history it is read from, up to the moment viewed: rebuilt with each snapshot. */
export function useEventLog() {
  const kept = useKeptHistory();
  const actions = useOperatorActions();
  const { viewedAt } = usePlayback();
  const { events, history } = eventLogOf(kept, actions, viewedAt);
  return { events, history, actions };
}
