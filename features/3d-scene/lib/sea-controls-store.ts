"use client";

import { useSyncExternalStore } from "react";
import { SEASCAPE_WIND } from "./seascape-config";

/**
 * The sea the user sets, in the Ontology: the wind's speed, m/s, and the side
 * its waves come from, degrees off the bow, starboard positive. Null for
 * either follows the live data — and, without it, the scene's defaults.
 */
export type SeaControls = { speedMs: number | null; fromRelativeDeg: number | null };

/** The scene's own sea, without live data or the user's: a fresh breeze, the waves from ahead. */
export const DEFAULT_SEA = { speedMs: SEASCAPE_WIND.speed as number, fromRelativeDeg: 0 } as const;

const FOLLOWING_DATA: SeaControls = { speedMs: null, fromRelativeDeg: null };
let state = FOLLOWING_DATA;
const listeners = new Set<() => void>();

function update(change: Partial<SeaControls>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useSeaControls(): SeaControls {
  return useSyncExternalStore(subscribe, () => state, () => FOLLOWING_DATA);
}

export const setSeaWindSpeed = (speedMs: number) => update({ speedMs });
export const setSeaWavesFrom = (fromRelativeDeg: number) => update({ fromRelativeDeg });
/** Back to the live data's sea. */
export const followDataSea = () => update(FOLLOWING_DATA);
