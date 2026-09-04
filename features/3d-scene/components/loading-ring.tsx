"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  createLoadingRing,
  setAssemblyTargets,
  type LoadingRingOverride,
  type LoadingRingUniforms,
} from "../lib/loading-ring-particles";


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
  onControlsReady?: (controls: {
    uniforms: LoadingRingUniforms;
    override: LoadingRingOverride;
  }) => void;
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
  onControlsReady,
}: Props) {
  const { geometry, material, uniforms, override } = useMemo(
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
    onControlsReady?.({ uniforms, override });
  }, [uniforms, override, onControlsReady]);

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

  useFrame((state) => {
    // Each stage has its own duration, tunable in the GUI, and the same values
    // drive the real sequence — so what is previewed is what ships.
    const fillMs = override.fillSeconds * 1000;
    const convergeMs = override.convergeSeconds * 1000;
    const holdMs = override.holdSeconds * 1000;
    const revealMs = override.revealSeconds * 1000;

    // Loop preview: replay fill -> converge -> hold -> reveal forever.
    if (override.isLooping) {
      const total = fillMs + convergeMs + holdMs + revealMs;
      const elapsed = (state.clock.elapsedTime * 1000) % total;

      const intoConverge = elapsed - fillMs;
      const intoHold = intoConverge - convergeMs;
      const intoReveal = intoHold - holdMs;

      if (elapsed < fillMs) {
        uniforms.progress.value = elapsed / fillMs;
        // Alternate direction per replay, so a fill-out can be seen here too.
        const replay = Math.floor((state.clock.elapsedTime * 1000) / total);
        uniforms.arcInvert.value = replay % 2;
      }
      uniforms.assembly.value = unitClamp(intoConverge / convergeMs);
      uniforms.fade.value =
        intoReveal > 0 ? 1 - unitClamp(intoReveal / revealMs) : 1;
      uniforms.dispersion.value = 0;

      override.progress = uniforms.progress.value;
      override.assembly = uniforms.assembly.value;
      override.fade = uniforms.fade.value;
      // The ship rises into view as the particles fade off it.
      override.shipReveal = intoReveal > 0 ? unitClamp(intoReveal / revealMs) : 0;
      return;
    }

    // Pin wins next, so the GUI can freeze any single moment.
    if (override.isPinned) {
      uniforms.progress.value = override.progress;
      uniforms.dispersion.value = override.dispersion;
      uniforms.assembly.value = override.assembly;
      uniforms.fade.value = override.fade;
      override.shipReveal = 1 - override.fade;
      return;
    }

    const elapsed = performance.now() - phaseStartRef.current;
    uniforms.dispersion.value = 0;

    if (phase === "filling") {
      // Repeating sweep, alternating direction every cycle: fills in, then
      // empties, then fills in again. Each cycle therefore *ends* where the
      // next begins, so waiting on a slow load reads as one continuous
      // animation rather than a restart.
      uniforms.progress.value = (elapsed % fillMs) / fillMs;
      uniforms.arcInvert.value = Math.floor(elapsed / fillMs) % 2;
      uniforms.assembly.value = 0;
      uniforms.fade.value = 1;
      override.shipReveal = 0;
      override.progress = uniforms.progress.value;
      override.assembly = 0;
      override.fade = 1;
      return;
    }

    // Past the fill, the arc is deliberately left frozen wherever the handover
    // caught it. Snapping it to full would pop; instead the shader's litness
    // term ramps every particle to fully lit as `assembly` rises, so the ring
    // completes itself on the way to the ship.
    uniforms.assembly.value =
      phase === "converging" ? unitClamp(elapsed / convergeMs) : 1;

    const revealed = phase === "revealing" ? unitClamp(elapsed / revealMs) : 0;
    uniforms.fade.value = phase === "done" ? 0 : 1 - revealed;
    override.shipReveal = phase === "done" ? 1 : revealed;

    // Mirror into the override so the GUI's listening readouts follow the real
    // sequence too, not just the loop preview.
    override.progress = uniforms.progress.value;
    override.assembly = uniforms.assembly.value;
    override.fade = uniforms.fade.value;
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
