"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Bumped at the end of a fill cycle that could not hand over, to start another. */
  const [fillCycle, setFillCycle] = useState(0);

  // Read through a ref, never a dependency. Becoming ready mid-cycle must not
  // restart the cycle: the ring animates the sweep from its own clock, so a
  // restarted timer here would hand over part-way through a sweep instead of at
  // its end — which is exactly what the whole-cycle rule exists to prevent.
  const canHandOverRef = useRef(false);
  canHandOverRef.current = isModelReady && hasAssemblyTargets;

  useEffect(() => {
    if (phase !== "filling") return;
    const timer = window.setTimeout(() => {
      if (canHandOverRef.current) setPhase("converging");
      // Otherwise run another identical cycle. This has to bump a counter
      // rather than re-set the phase: setting state to the value it already
      // holds is a no-op, so the effect would never re-run and no further cycle
      // would ever be armed.
      else setFillCycle((cycle) => cycle + 1);
    }, LOADING_RING_TIMING.FILL_MS);
    return () => window.clearTimeout(timer);
  }, [phase, fillCycle]);

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
    if (isModelReady) return;
    setPhase("filling");
    setFillCycle((cycle) => cycle + 1);
  }, [isModelReady]);

  return {
    phase,
    isRingVisible: phase !== "done",
    isInteractive: phase === "done",
  };
}
