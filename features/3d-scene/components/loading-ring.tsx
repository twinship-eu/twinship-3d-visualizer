"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  createLoadingRing,
  type LoadingRingOverride,
  type LoadingRingUniforms,
} from "../lib/loading-ring-particles";
import { LOADING_RING_TIMING, RING_WATERLINE_Y } from "../lib/3d-scene-config";

/**
 * Share of a test loop spent filling; the rest is the burst. Half and half, so
 * the bubbles get long enough to actually be watched scattering.
 */
const LOOP_FILL_FRACTION = 0.5;

type Props = {
  /** 0 -> 1 as the model loads. */
  progress: number;
  /** 0 = intact ring, 1 = fully burst and faded. */
  dispersion: number;
  /** Hands the ring's tunables to the dev Inspector, if one is attached. */
  onControlsReady?: (controls: {
    uniforms: LoadingRingUniforms;
    override: LoadingRingOverride;
  }) => void;
};

/**
 * The in-scene loading indicator: a tilted ring of particles hovering at the
 * waterline where the ship will appear. The scene behind it stays fully
 * visible, and the water reflects it.
 *
 * Targets arrive as props but are interpolated here, in useFrame, and written
 * straight to the uniforms. Driving them through React state would re-render at
 * frame rate during the very load this is covering.
 */
export function LoadingRing({ progress, dispersion, onControlsReady }: Props) {
  const { geometry, material, uniforms, override } = useMemo(
    () => createLoadingRing(),
    []
  );
  const targets = useRef({ progress, dispersion });
  targets.current = { progress, dispersion };

  useEffect(() => {
    onControlsReady?.({ uniforms, override });
  }, [uniforms, override, onControlsReady]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state, delta) => {
    // Test loop: replay fill-then-burst forever. Written straight to the
    // uniforms with no smoothing, so each cycle is identical and repeatable.
    if (override.isLooping) {
      const cycle =
        (state.clock.elapsedTime % override.loopSeconds) / override.loopSeconds;
      const isFilling = cycle < LOOP_FILL_FRACTION;
      uniforms.progress.value = isFilling ? cycle / LOOP_FILL_FRACTION : 1;
      uniforms.dispersion.value = isFilling
        ? 0
        : (cycle - LOOP_FILL_FRACTION) / (1 - LOOP_FILL_FRACTION);
      // Mirror back into the override so the GUI's listening readouts track the
      // loop instead of showing whatever they were left at.
      override.progress = uniforms.progress.value;
      override.dispersion = uniforms.dispersion.value;
      return;
    }

    // The dev pin wins next, so the GUI can hold the fill or the burst still.
    const target = override.isPinned ? override : targets.current;
    // Exponential smoothing, framerate-independent so a long frame cannot snap.
    const k = 1 - Math.exp(-LOADING_RING_TIMING.SMOOTHING_RATE * delta);
    uniforms.progress.value += (target.progress - uniforms.progress.value) * k;
    uniforms.dispersion.value +=
      (target.dispersion - uniforms.dispersion.value) * k;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, RING_WATERLINE_Y, 0]}
      frustumCulled={false}
    />
  );
}
