"use client";

import { useSyncExternalStore } from "react";

/**
 * The hour the user sets, in the Ontology: the time of day, UTC, hours from 0
 * to 24, the sun is shown at. Null follows the live data's own clock — and,
 * without data, the scene's own sun.
 */
export type SkyControls = { hourUtc: number | null };

/** Where the sun is worked out for when there is no ship's position: the North Sea, where the recorded voyage begins. */
export const DEFAULT_SKY_PLACE = { latitude: 56.12, longitude: 7.45 } as const;

/** The hour the Ontology opens at, UTC: the sun high, the ship well lit from every side. */
export const ONTOLOGY_DEFAULT_HOUR_UTC = 11;
/**
 * The heading the Ontology lights the ship for, °: not the voyage's, but one
 * that puts the late-morning sun (south-south-east) ahead of the camera as it
 * opens off the port bow — past the ship's starboard quarter, about 150° off
 * the bow — its light on the water in view.
 */
export const ONTOLOGY_SUN_HEADING_DEG = 10;
/**
 * The Ontology's wind, knots: its own, not the voyage's (23 kn, force 6, in
 * the recording) — a light breeze's sea, for looking at the ship, not at the
 * weather. The sea's sliders still set any other.
 */
export const ONTOLOGY_WIND_KN = 10;

const FOLLOWING_DATA: SkyControls = { hourUtc: null };
let state = FOLLOWING_DATA;
const listeners = new Set<() => void>();

function update(change: Partial<SkyControls>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useSkyControls(): SkyControls {
  return useSyncExternalStore(subscribe, () => state, () => FOLLOWING_DATA);
}

export const setSkyHour = (hourUtc: number) => update({ hourUtc });
/** Back to the data's clock. */
export const followDataSky = () => update(FOLLOWING_DATA);
