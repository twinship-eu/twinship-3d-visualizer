"use client";

import { useSyncExternalStore } from "react";
import { PANE_SYSTEMS, type HudMode, type PaneSystem } from "../bridge-config";

export type BridgeState = {
  /** Whether the camera is on the bridge. */
  isActive: boolean;
  hudMode: HudMode;
  isNight: boolean;
  /** Which system each pane shows, left to right. */
  panes: PaneSystem[];
};

const INITIAL: BridgeState = { isActive: false, hudMode: "full", isNight: false, panes: [...PANE_SYSTEMS] };

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

/** Moves a system to a pane: the one there takes its place. */
export function assignPane(paneIndex: number, system: PaneSystem) {
  const panes = [...state.panes];
  const from = panes.indexOf(system);
  if (from === -1 || from === paneIndex) return;
  [panes[from], panes[paneIndex]] = [panes[paneIndex], panes[from]];
  update({ panes });
}
