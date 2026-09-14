"use client";

import { useMemo } from "react";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";
import { getSunDirection, SKY_SCALE, SKY_UNIFORMS } from "../lib/3d-scene-config";

/**
 * Builds a Sky configured from SKY_UNIFORMS. Also used to bake the scene IBL,
 * which passes overrides to damp the sun's glare — see
 * ENVIRONMENT_SKY_OVERRIDES.
 */
export function createSky(
  // Widened to `number`: SKY_UNIFORMS is `as const`, so `Partial<typeof ...>`
  // would only accept the very literals it already holds.
  overrides: Partial<Record<keyof typeof SKY_UNIFORMS, number>> = {}
): SkyMesh {
  const uniforms = { ...SKY_UNIFORMS, ...overrides };
  const sky = new SkyMesh();
  sky.scale.setScalar(SKY_SCALE);
  sky.sunPosition.value.copy(getSunDirection());
  sky.turbidity.value = uniforms.turbidity;
  sky.rayleigh.value = uniforms.rayleigh;
  sky.mieCoefficient.value = uniforms.mieCoefficient;
  sky.mieDirectionalG.value = uniforms.mieDirectionalG;
  sky.cloudCoverage.value = uniforms.cloudCoverage;
  sky.cloudDensity.value = uniforms.cloudDensity;
  sky.cloudElevation.value = uniforms.cloudElevation;
  sky.cloudScale.value = uniforms.cloudScale;
  sky.cloudSpeed.value = uniforms.cloudSpeed;
  return sky;
}

/**
 * The sky needs no per-frame work: SkyMesh drives its cloud drift from TSL's
 * global `time` node, so the clock-advancing `useFrame` the GLSL Sky required is
 * gone along with its ref.
 */
export function SceneSky() {
  const sky = useMemo(() => createSky(), []);

  return <primitive object={sky} />;
}
