"use client";

import { useSyncExternalStore } from "react";
import { useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import type { Alarm } from "@/features/live-data/live-data-types";

/** The behaviour anomaly open over the scene, by its alarm's id; null for none. */
let openId: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function openAnomaly(alarmId: string | null) {
  openId = alarmId;
  listeners.forEach((listener) => listener());
}
export const closeAnomaly = () => openAnomaly(null);

export function useOpenAnomalyId() {
  return useSyncExternalStore(subscribe, () => openId, () => null);
}

/** The open anomaly as the data has it now, or null: gone from the data, it closes. */
export function useOpenAnomaly(): Alarm | null {
  const id = useOpenAnomalyId();
  const snapshot = useLiveData();
  return id ? (snapshot?.alarms.find((alarm) => alarm.id === id && alarm.anomaly) ?? null) : null;
}

/** The open anomaly's score over the minute kept, oldest first: for its trend. */
export function useAnomalyScoreHistory(alarmId: string | null) {
  const history = useLiveHistory();
  if (!alarmId) return [];
  return history.flatMap((snapshot) => {
    const score = snapshot.alarms.find((alarm) => alarm.id === alarmId)?.anomaly?.score;
    return score === undefined ? [] : [score];
  });
}
