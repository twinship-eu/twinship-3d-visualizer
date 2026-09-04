"use client";

import { useEffect, useState } from "react";
import { LOADING_RING_TIMING } from "@/features/3d-scene/lib/3d-scene-config";

export type LoadingRingPhase =
  | "filling"
  | "converging"
  | "holding"
  | "revealing"
  | "done";

export type ModelLoadProgress = {
  phase: LoadingRingPhase;
  /** False once the particles have fully faded and the ring can unmount. */
  isRingVisible: boolean;
  /** False until the ship should be revealed beneath the fading particles. */
  isShipVisible: boolean;
  /**
   * False until the animation has finished. Hovering or clicking mid-sequence
   * highlights and dims parts of a ship that is still assembling, which fights
   * the animation and looks broken.
   */
  isInteractive: boolean;
};

/**
 * Drives the loading ring through fill → converge → hold → reveal.
 *
 * The fill repeats in whole cycles of `FILL_MS` and only hands over at a cycle
 * boundary, so a model that arrives mid-sweep waits for the sweep to finish and
 * a model that arrives late simply gets another identical cycle. That is what
 * guarantees the transition always plays in full — and it is why the arc is a
 * repeating animation rather than a progress meter: a percent-driven sweep would
 * stall part-way and never reach a boundary to hand over on.
 *
 * Consequence worth knowing: every visit costs at least one full cycle plus the
 * ending, even when the model is already cached.
 *
 * Load failure needs no handling here. `useGLTF` throws during render and the
 * ring sits inside the scene's existing error boundary, so that boundary takes
 * the viewport and the ring with it.
 */
export function useModelLoadProgress(
  isModelReady: boolean,
  hasAssemblyTargets: boolean
): ModelLoadProgress {
  const [phase, setPhase] = useState<LoadingRingPhase>("filling");

  // Hand over only at the end of a fill cycle, and only once the model is ready
  // *and* its surface has been sampled — converging needs somewhere to converge.
  const canHandOver = isModelReady && hasAssemblyTargets;

  useEffect(() => {
    if (phase !== "filling") return;
    const timer = window.setTimeout(() => {
      if (canHandOver) setPhase("converging");
      // Not ready: fall through and let this effect re-arm for another cycle.
      else setPhase("filling");
    }, LOADING_RING_TIMING.FILL_MS);
    return () => window.clearTimeout(timer);
    // `canHandOver` is intentionally in the deps: becoming ready mid-cycle must
    // not cut the cycle short, but the re-armed timer must see the new value.
  }, [phase, canHandOver]);

  useEffect(() => {
    if (phase !== "converging") return;
    const timer = window.setTimeout(
      () => setPhase("holding"),
      LOADING_RING_TIMING.CONVERGE_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "holding") return;
    const timer = window.setTimeout(
      () => setPhase("revealing"),
      LOADING_RING_TIMING.HOLD_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const timer = window.setTimeout(
      () => setPhase("done"),
      LOADING_RING_TIMING.REVEAL_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  // A new load — switching model variants — restarts the whole sequence.
  useEffect(() => {
    if (!isModelReady) setPhase("filling");
  }, [isModelReady]);

  return {
    phase,
    isRingVisible: phase !== "done",
    isShipVisible: phase === "revealing" || phase === "done",
    isInteractive: phase === "done",
  };
}
