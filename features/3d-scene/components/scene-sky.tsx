"use client";

import { useMemo } from "react";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";
import { getSunDirection, SKY_SCALE, SKY_UNIFORMS } from "../lib/3d-scene-config";

/** Builds a Sky configured from SKY_UNIFORMS. Also used to bake the scene IBL. */
export function createSky(): SkyMesh {
  const sky = new SkyMesh();
  sky.scale.setScalar(SKY_SCALE);
  sky.sunPosition.value.copy(getSunDirection());
  sky.turbidity.value = SKY_UNIFORMS.turbidity;
  sky.rayleigh.value = SKY_UNIFORMS.rayleigh;
  sky.mieCoefficient.value = SKY_UNIFORMS.mieCoefficient;
  sky.mieDirectionalG.value = SKY_UNIFORMS.mieDirectionalG;
  sky.cloudCoverage.value = SKY_UNIFORMS.cloudCoverage;
  sky.cloudDensity.value = SKY_UNIFORMS.cloudDensity;
  sky.cloudElevation.value = SKY_UNIFORMS.cloudElevation;
  sky.cloudScale.value = SKY_UNIFORMS.cloudScale;
  sky.cloudSpeed.value = SKY_UNIFORMS.cloudSpeed;
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
