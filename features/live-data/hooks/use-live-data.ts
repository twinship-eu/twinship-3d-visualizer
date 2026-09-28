"use client";

import { useSyncExternalStore } from "react";
import { liveDataStore } from "../lib/live-data-store";
import type { Alarm, LiveSnapshot } from "../live-data-types";

const getServerSnapshot = () => null;
const NO_HISTORY: LiveSnapshot[] = [];
const getServerHistory = () => NO_HISTORY;

/**
 * The ship's latest snapshot, updated as the source sends them; null before
 * the first one (and on the server).
 */
export function useLiveData(): LiveSnapshot | null {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getSnapshot, getServerSnapshot);
}

/** The last minute of snapshots, oldest first: for the trends. Empty on the server. */
export function useLiveHistory(): LiveSnapshot[] {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getHistory, getServerHistory);
}

/** Alarms and warnings not yet acknowledged: what the badges count. */
export function getActiveAlarms(snapshot: LiveSnapshot | null): Alarm[] {
  return (snapshot?.alarms ?? []).filter(
    (alarm) => !alarm.isAcknowledged && (alarm.severity === "alarm" || alarm.severity === "warning")
  );
}

/** Acknowledges an alarm: it leaves the active ones, and stays in the log. */
export function acknowledgeAlarm(alarmId: string) {
  liveDataStore.acknowledgeAlarm(alarmId);
}

/** The first active alarm on a component, by its label; null if it has none. */
export function activeAlarmOn(snapshot: LiveSnapshot | null, componentLabel: string): Alarm | null {
  return getActiveAlarms(snapshot).find((alarm) => alarm.componentLabel === componentLabel) ?? null;
}
