"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createDepthVeilMaterial } from "../lib/depth-veil-shader";
import { DEPTH_VEIL_TIMING } from "../lib/3d-scene-config";

/** Renders in front of everything else in the scene. */
const VEIL_RENDER_ORDER = 999;

type Props = {
  /** 1 = abyss, 0 = surface. */
  depth: number;
  /** 1 = fully covering, 0 = fully dissolved. */
  opacity: number;
};

/**
 * A fullscreen quad carrying the loading shader.
 *
 * Targets arrive as props but are *interpolated here*, in useFrame, and written
 * straight to the uniforms. Driving them through React state would re-render at
 * frame rate during the very load this is covering.
 */
export function DepthVeil({ depth, opacity }: Props) {
  const { material, uniforms } = useMemo(() => createDepthVeilMaterial(), []);
  const targets = useRef({ depth, opacity });
  targets.current = { depth, opacity };

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    // Exponential smoothing, framerate-independent so a long frame cannot snap.
    const k = 1 - Math.exp(-DEPTH_VEIL_TIMING.SMOOTHING_RATE * delta);
    uniforms.depth.value += (targets.current.depth - uniforms.depth.value) * k;
    uniforms.opacity.value +=
      (targets.current.opacity - uniforms.opacity.value) * k;
  });

  return (
    <mesh renderOrder={VEIL_RENDER_ORDER} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
