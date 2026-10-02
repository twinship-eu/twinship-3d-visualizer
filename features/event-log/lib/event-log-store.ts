"use client";

import { useSyncExternalStore } from "react";

/**
 * What the log panel and the scene share while the log is open: the event
 * selected (the ship focuses on its component) and whether the time series
 * drawer is out.
 */
type State = { selectedEventId: string | null; isTimeSeriesOpen: boolean };

const INITIAL: State = { selectedEventId: null, isTimeSeriesOpen: false };
let state = INITIAL;
const listeners = new Set<() => void>();

function update(change: Partial<State>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useEventLogState(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export const selectLogEvent = (selectedEventId: string | null) => update({ selectedEventId });
export const setTimeSeriesOpen = (isTimeSeriesOpen: boolean) => update({ isTimeSeriesOpen });
/** The log closed: nothing selected, the drawer in. */
export const resetEventLogState = () => update(INITIAL);
