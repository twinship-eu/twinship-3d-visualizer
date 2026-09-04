"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { LOADING_RING_TIMING } from "@/features/3d-scene/lib/3d-scene-config";

export type LoadingRingPhase =
  | "hidden"
  | "filling"
  | "completing"
  | "dispersing";

export type ModelLoadProgress = {
  /** False until the ring should mount, and again once it has fully burst. */
  isRingVisible: boolean;
  /** Target for the ring's progress uniform: 0 = empty, 1 = closed. */
  progress: number;
  /** Target for the ring's dispersion uniform: 0 = intact, 1 = burst away. */
  dispersion: number;
  phase: LoadingRingPhase;
};

/** Percent complete, as drei reports it. */
const COMPLETE_PERCENT = 100;

/**
 * Turns the loader's noisy progress into the ring's two targets.
 *
 * `useProgress` reads DefaultLoadingManager, whose `total` grows as the GLB and
 * then each embedded texture is discovered — so raw progress jumps backwards and
 * briefly reports completion between items. It is used only to *fill* the
 * arc, clamped monotonic. Completion comes from `isModelReady`, which the
 * visualizer derives from its own tree callback, after parse and post-processing.
 *
 * Deliberately absent: any reading of `useProgress().errors`. A failed load
 * throws out of `useGLTF` during render, and the ring sits inside the scene's
 * existing error boundary, so the boundary takes the viewport and the ring with
 * it. Polling errors would be a second path that could disagree with the first.
 */
export function useModelLoadProgress(isModelReady: boolean): ModelLoadProgress {
  // drei's useProgress is a zustand bound store, so pass a selector: reading the
  // whole object would re-render on every field, including `item`, which changes
  // once per embedded texture.
  const reportedProgress = useProgress((state) => state.progress);
  const [phase, setPhase] = useState<LoadingRingPhase>("hidden");
  const highWaterMark = useRef(0);
  const shownAt = useRef<number | null>(null);

  highWaterMark.current = Math.max(highWaterMark.current, reportedProgress);

  // Grace period: a cached model that is ready inside it never shows the ring.
  useEffect(() => {
    if (phase !== "hidden" || isModelReady) return;
    const timer = window.setTimeout(() => {
      shownAt.current = performance.now();
      setPhase("filling");
    }, LOADING_RING_TIMING.SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  // Hold the fill for a minimum time so a fast load still reads as a fill.
  useEffect(() => {
    if (phase !== "filling" || !isModelReady) return;
    const shown = shownAt.current ?? performance.now();
    const remaining = Math.max(
      0,
      LOADING_RING_TIMING.MIN_VISIBLE_MS - (performance.now() - shown)
    );
    const timer = window.setTimeout(() => setPhase("completing"), remaining);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  useEffect(() => {
    if (phase !== "completing") return;
    const timer = window.setTimeout(
      () => setPhase("dispersing"),
      LOADING_RING_TIMING.COMPLETE_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "dispersing") return;
    const timer = window.setTimeout(() => {
      shownAt.current = null;
      highWaterMark.current = 0;
      setPhase("hidden");
    }, LOADING_RING_TIMING.BURST_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // A new load (model switch) re-arms the machine.
  useEffect(() => {
    if (isModelReady) return;
    highWaterMark.current = 0;
    shownAt.current = null;
  }, [isModelReady]);

  const isFilling = phase === "filling";
  // Once filling is done the arc holds closed, so later phases report 1.
  const progress = isFilling
    ? highWaterMark.current / COMPLETE_PERCENT
    : 1;

  return {
    isRingVisible: phase !== "hidden",
    progress,
    dispersion: phase === "dispersing" ? 1 : 0,
    phase,
  };
}
