"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  createLoadingRing,
  LOADING_RING_REVEAL,
  setAssemblyTargets,
} from "../lib/loading-ring-particles";
import { LOADING_RING_TIMING } from "../lib/3d-scene-config";


/** Drawn after the scene, since the particles are not depth-tested. */
const RING_RENDER_ORDER = 999;

export type LoadingRingPhase =
  | "filling"
  | "converging"
  | "holding"
  | "revealing"
  | "done";

type Props = {
  phase: LoadingRingPhase;
  /** World-space points sampled from the loaded ship, or null before it loads. */
  assemblyTargets: Float32Array | null;
};

/** Clamps to 0..1 without pulling in a helper for one line. */
function unitClamp(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The in-scene loading indicator: a ring of particles at the waterline that
 * fills, then flies onto the loaded ship's own surface, holds as a particle
 * silhouette, and fades out as the real ship is revealed beneath it.
 *
 * The scene behind it stays fully visible throughout, and the water reflects it.
 *
 * All animation happens here in useFrame, driven by the phase prop and an
 * elapsed-in-phase clock. React only ever hands over discrete phase changes —
 * driving these values through state would re-render at frame rate during the
 * very load this is covering.
 */
export function LoadingRing({
  phase,
  assemblyTargets,
}: Props) {
  const { geometry, material, uniforms } = useMemo(
    () => createLoadingRing(),
    []
  );
  const phaseStartRef = useRef(performance.now());
  const lastPhaseRef = useRef<LoadingRingPhase>(phase);

  if (lastPhaseRef.current !== phase) {
    lastPhaseRef.current = phase;
    phaseStartRef.current = performance.now();
  }

  useEffect(() => {
    if (assemblyTargets === null) return;
    setAssemblyTargets(geometry, assemblyTargets);
  }, [geometry, assemblyTargets]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(() => {
    const { FILL_MS, CONVERGE_MS, REVEAL_MS } = LOADING_RING_TIMING;
    const elapsed = performance.now() - phaseStartRef.current;

    if (phase === "filling") {
      // Repeating sweep, alternating direction every cycle: fills in, then
      // empties, then fills in again. Each cycle therefore *ends* where the
      // next begins, so waiting on a slow load reads as one continuous
      // animation rather than a restart.
      uniforms.progress.value = (elapsed % FILL_MS) / FILL_MS;
      uniforms.arcInvert.value = Math.floor(elapsed / FILL_MS) % 2;
      uniforms.assembly.value = 0;
      uniforms.fade.value = 1;
      LOADING_RING_REVEAL.shipReveal = 0;
      return;
    }

    // Past the fill, the arc is deliberately left frozen wherever the handover
    // caught it. Snapping it to full would pop; instead the shader's litness
    // term ramps every particle to fully lit as `assembly` rises, so the ring
    // completes itself on the way to the ship.
    uniforms.assembly.value =
      phase === "converging" ? unitClamp(elapsed / CONVERGE_MS) : 1;

    const revealed = phase === "revealing" ? unitClamp(elapsed / REVEAL_MS) : 0;
    uniforms.fade.value = phase === "done" ? 0 : 1 - revealed;
    LOADING_RING_REVEAL.shipReveal = phase === "done" ? 1 : revealed;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={RING_RENDER_ORDER}
    />
  );
}
