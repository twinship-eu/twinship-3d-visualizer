"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { DEPTH_VEIL_TIMING } from "@/features/3d-scene/lib/3d-scene-config";

export type DepthVeilPhase = "hidden" | "rising" | "surfacing" | "dissolving";

export type ModelLoadProgress = {
  isVeilVisible: boolean;
  depth: number;
  opacity: number;
  phase: DepthVeilPhase;
};

/** Percent complete, as drei reports it. */
const COMPLETE_PERCENT = 100;

/**
 * Turns the loader's noisy progress into the veil's two targets.
 *
 * `useProgress` reads DefaultLoadingManager, whose `total` grows as the GLB and
 * then each embedded texture is discovered — so raw progress jumps backwards and
 * briefly reports completion between items. It is used only to *position* the
 * rise, clamped monotonic. Completion comes from `isModelReady`, which the
 * visualizer derives from its own tree callback, after parse and post-processing.
 *
 * Deliberately absent: any reading of `useProgress().errors`. A failed load
 * throws out of `useGLTF` during render, and the veil sits inside the scene's
 * existing error boundary, so the boundary takes the viewport and the veil with
 * it. Polling errors would be a second path that could disagree with the first.
 */
export function useModelLoadProgress(isModelReady: boolean): ModelLoadProgress {
  // drei's useProgress is a zustand bound store, so pass a selector: reading the
  // whole object would re-render on every field, including `item`, which changes
  // once per embedded texture.
  const progress = useProgress((state) => state.progress);
  const [phase, setPhase] = useState<DepthVeilPhase>("hidden");
  const highWaterMark = useRef(0);
  const shownAt = useRef<number | null>(null);

  highWaterMark.current = Math.max(highWaterMark.current, progress);

  // Grace period: a cached model that is ready inside it never shows the veil.
  useEffect(() => {
    if (phase !== "hidden" || isModelReady) return;
    const timer = window.setTimeout(() => {
      shownAt.current = performance.now();
      setPhase("rising");
    }, DEPTH_VEIL_TIMING.SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  // Hold the rise for a minimum time so a fast load still reads as a rise.
  useEffect(() => {
    if (phase !== "rising" || !isModelReady) return;
    const shown = shownAt.current ?? performance.now();
    const remaining = Math.max(
      0,
      DEPTH_VEIL_TIMING.MIN_VISIBLE_MS - (performance.now() - shown)
    );
    const timer = window.setTimeout(() => setPhase("surfacing"), remaining);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  useEffect(() => {
    if (phase !== "surfacing") return;
    const timer = window.setTimeout(
      () => setPhase("dissolving"),
      DEPTH_VEIL_TIMING.SURFACE_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "dissolving") return;
    const timer = window.setTimeout(() => {
      shownAt.current = null;
      highWaterMark.current = 0;
      setPhase("hidden");
    }, DEPTH_VEIL_TIMING.DISSOLVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // A new load (model switch) re-arms the machine.
  useEffect(() => {
    if (isModelReady) return;
    highWaterMark.current = 0;
    shownAt.current = null;
  }, [isModelReady]);

  const isRising = phase === "rising";
  const isVeilVisible = phase !== "hidden";
  const depth = isRising ? 1 - highWaterMark.current / COMPLETE_PERCENT : 0;

  return {
    isVeilVisible,
    depth,
    opacity: phase === "dissolving" ? 0 : 1,
    phase,
  };
}
