"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_WINDOW_SYSTEMS, type HudMode, type PaneSystem } from "../bridge-config";

export type BridgeState = {
  /** Whether the camera is on the bridge. */
  isActive: boolean;
  hudMode: HudMode;
  isNight: boolean;
  /** The systems each HUD window shows: the left window first, each in order. */
  windows: PaneSystem[][];
};

const INITIAL: BridgeState = { isActive: false, hudMode: "full", isNight: false, windows: DEFAULT_WINDOW_SYSTEMS };

let state = INITIAL;
const listeners = new Set<() => void>();

function update(change: Partial<BridgeState>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The bridge view's state, shared by the camera and the glass in the Canvas
 * and by the controls and the pane cards outside it: a plain store, as the
 * Canvas is its own React root.
 */
export function useBridgeState(): BridgeState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export const getBridgeState = () => state;
export const setBridgeActive = (isActive: boolean) => update({ isActive });
export const setHudMode = (hudMode: HudMode) => update({ hudMode });
export const setNight = (isNight: boolean) => update({ isNight });

/** Moves a system to the end of a window; a window keeps at least one. */
export function moveToWindow(system: PaneSystem, windowIndex: number) {
  const from = state.windows.findIndex((systems) => systems.includes(system));
  if (from === -1 || from === windowIndex || state.windows[from].length === 1) return;
  update({
    windows: state.windows.map((systems, index) =>
      index === from ? systems.filter((other) => other !== system) : index === windowIndex ? [...systems, system] : systems
    ),
  });
}
