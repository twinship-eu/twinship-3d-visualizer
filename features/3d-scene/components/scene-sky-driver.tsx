"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { liveSceneOverrides } from "../lib/live-scene-overrides";
import { DEFAULT_SUN, setSun } from "../lib/sky-state";

/** Seconds the ship's heading takes to be mostly taken: the sky does not jerk with every reading. */
const HEADING_TIME_CONSTANT = 4;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;
/** A heading further off than this is not wandering but changed (the data arriving): taken at once. */
const SNAP_HEADING_DEG = 15;

const wrapSigned = (degrees: number) => ((((degrees + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;

/**
 * Inside the Canvas: puts the sun in the sky where the data's place and time
 * say, off the ship's bow by its heading — eased, as the data's heading
 * wanders — and back in the scene's own place without data.
 */
export function SceneSkyDriver() {
  /** The heading as eased so far; null before the first. */
  const eased = useRef<number | null>(null);

  useFrame((_, delta) => {
    const sun = liveSceneOverrides.sun;
    if (!sun) {
      eased.current = null;
      setSun(DEFAULT_SUN.elevationDeg, DEFAULT_SUN.relativeBearingDeg);
      return;
    }
    const previous = eased.current ?? sun.headingDeg;
    const off = wrapSigned(sun.headingDeg - previous);
    const heading = Math.abs(off) > SNAP_HEADING_DEG ? sun.headingDeg : previous + off * (1 - Math.exp(-delta / HEADING_TIME_CONSTANT));
    eased.current = heading;
    setSun(sun.elevationDeg, wrapSigned(sun.azimuthDeg - heading), heading);
  });

  return null;
}
