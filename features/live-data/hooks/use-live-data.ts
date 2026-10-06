"use client";

import { useSyncExternalStore } from "react";
import { liveDataStore, type Playback } from "../lib/live-data-store";
import type { Alarm, LiveSnapshot, OperatorAction } from "../live-data-types";

const getServerSnapshot = () => null;
const NO_HISTORY: LiveSnapshot[] = [];
const getServerHistory = () => NO_HISTORY;
const NO_PLAYBACK: Playback = { viewedAt: null, oldest: null, latest: null, isPlaying: true };
const getServerPlayback = () => NO_PLAYBACK;
const NO_SILENCES: Record<string, number> = {};
const getServerSilences = () => NO_SILENCES;
const NO_ACTIONS: OperatorAction[] = [];
const getServerActions = () => NO_ACTIONS;

/**
 * The ship's snapshot at the moment viewed — the latest while live, updated
 * as the source sends them; null before the first one (and on the server).
 */
export function useLiveData(): LiveSnapshot | null {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getSnapshot, getServerSnapshot);
}

/** The minute of snapshots up to the moment viewed, oldest first: for the trends. Empty on the server. */
export function useLiveHistory(): LiveSnapshot[] {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getHistory, getServerHistory);
}

/**
 * Every snapshot kept, oldest first — the timeline's whole window: for the
 * event log and the readings. Re-renders with each snapshot.
 */
export function useKeptHistory(): LiveSnapshot[] {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getKeptHistory, getServerHistory);
}

/** What the operator did from the cockpit, oldest first. */
export function useOperatorActions(): OperatorAction[] {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getOperatorActions, getServerActions);
}

/** Alarms and warnings not yet acknowledged: what the badges count. */
export function getActiveAlarms(snapshot: LiveSnapshot | null): Alarm[] {
  return (snapshot?.alarms ?? []).filter(
    (alarm) => !alarm.isAcknowledged && (alarm.severity === "alarm" || alarm.severity === "warning")
  );
}

/** Where the viewer is in time, and how far back the history reaches: for the timeline. */
export function usePlayback(): Playback {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getPlayback, getServerPlayback);
}

/** Views a moment of the kept history — paused there, or playing on from it — or the live data again with null. */
export function viewLiveDataAt(moment: number | null, isPlaying = false) {
  liveDataStore.viewAt(moment, isPlaying);
}

/** The alarms silenced from the cockpit, by id: until when, ms since the epoch. */
export function useAlarmSilences(): Record<string, number> {
  return useSyncExternalStore(liveDataStore.subscribe, liveDataStore.getSilences, getServerSilences);
}

/** Silences an alarm until a moment, ms since the epoch: still active, no longer highlighted. */
export function silenceAlarm(alarmId: string, until: number) {
  liveDataStore.silenceAlarm(alarmId, until);
}

/** Acknowledges an alarm: it leaves the active ones, and stays in the log. */
export function acknowledgeAlarm(alarmId: string) {
  liveDataStore.acknowledgeAlarm(alarmId);
}

/** The first active alarm on a component, by its label; null if it has none. */
export function activeAlarmOn(snapshot: LiveSnapshot | null, componentLabel: string): Alarm | null {
  return getActiveAlarms(snapshot).find((alarm) => alarm.componentLabel === componentLabel) ?? null;
}
