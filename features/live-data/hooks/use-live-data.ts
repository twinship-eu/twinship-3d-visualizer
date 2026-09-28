"use client";

import { useSyncExternalStore } from "react";
import { liveDataStore } from "../lib/live-data-store";
import type { Alarm, LiveSnapshot } from "../live-data-types";

const getServerSnapshot = () => null;

/**
 * The ship's latest snapshot, updated as the source sends them; null before
 * the first one (and on the server).
 */
export function useLiveData(): LiveSnapshot | null {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getSnapshot, getServerSnapshot);
}

/** Alarms and warnings not yet acknowledged: what the badges count. */
export function getActiveAlarms(snapshot: LiveSnapshot | null): Alarm[] {
  return (snapshot?.alarms ?? []).filter(
    (alarm) => !alarm.isAcknowledged && (alarm.severity === "alarm" || alarm.severity === "warning")
  );
}
