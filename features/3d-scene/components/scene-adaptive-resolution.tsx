"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { getPerformanceProfile } from "../lib/performance-profile";

/** Seconds over which the frame rate is measured, each time. */
const MEASURE_SECONDS = 1;
/** Seconds after the start that are not measured: the shaders compile, the ship loads. */
const WARM_UP_SECONDS = 4;
/** Below this frame rate the resolution drops a step. */
const LOW_FPS = 45;
/** Above it, for RAISE_AFTER_WINDOWS measurements in a row, it rises a step again. */
const HIGH_FPS = 57;
const RAISE_AFTER_WINDOWS = 5;
/** How much each step changes the pixel ratio by. */
const STEP = 0.85;
/**
 * How many times it may drop again right after rising, before it stops
 * rising: a device that keeps falling back from the same resolution stays
 * below it, rather than stuttering every few seconds.
 */
const MAX_FALLBACKS = 3;
/** Longest frame counted, in seconds: a hidden tab's pause is not a slow frame. */
const LONGEST_FRAME = 0.25;

/**
 * Keeps the frame rate up by drawing fewer pixels: measures it every second,
 * lowers the pixel ratio a step when it falls below LOW_FPS, down to the
 * profile's `minPixelRatio`, and raises it again while it stays high. Phones
 * differ too much for one fixed resolution to suit them all.
 *
 * (A screen limited to 30 Hz, as in a phone's low-power mode, reads as slow
 * and goes to the lowest resolution.)
 */
export function SceneAdaptiveResolution() {
  const setDpr = useThree((state) => state.setDpr);
  const state = useRef({
    elapsed: 0,
    windowSeconds: 0,
    windowFrames: 0,
    highWindows: 0,
    /** Whether the last change was a rise, and how many drops came right after one. */
    hasJustRisen: false,
    fallbacks: 0,
    pixelRatio: NaN,
  });

  useFrame((_, delta) => {
    const measure = state.current;
    const profile = getPerformanceProfile();
    // Never more than the screen has
    const highest = Math.min(window.devicePixelRatio, profile.maxPixelRatio);
    const lowest = Math.min(highest, profile.minPixelRatio);
    if (Number.isNaN(measure.pixelRatio)) measure.pixelRatio = highest;

    const frame = Math.min(delta, LONGEST_FRAME);
    measure.elapsed += frame;
    if (measure.elapsed < WARM_UP_SECONDS) return;

    measure.windowSeconds += frame;
    measure.windowFrames++;
    if (measure.windowSeconds < MEASURE_SECONDS) return;

    const fps = measure.windowFrames / measure.windowSeconds;
    measure.windowSeconds = 0;
    measure.windowFrames = 0;

    let pixelRatio = measure.pixelRatio;
    if (fps < LOW_FPS) {
      pixelRatio = Math.max(lowest, pixelRatio * STEP);
      measure.highWindows = 0;
      if (pixelRatio !== measure.pixelRatio && measure.hasJustRisen) measure.fallbacks++;
      measure.hasJustRisen = false;
    } else if (fps > HIGH_FPS && pixelRatio < highest && measure.fallbacks < MAX_FALLBACKS) {
      measure.highWindows++;
      if (measure.highWindows >= RAISE_AFTER_WINDOWS) {
        pixelRatio = Math.min(highest, pixelRatio / STEP);
        measure.highWindows = 0;
        measure.hasJustRisen = true;
      }
    } else {
      measure.highWindows = 0;
    }

    if (pixelRatio !== measure.pixelRatio) {
      measure.pixelRatio = pixelRatio;
      setDpr(pixelRatio);
    }
  });

  return null;
}
