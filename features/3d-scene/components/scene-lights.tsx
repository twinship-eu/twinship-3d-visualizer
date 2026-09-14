"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { DirectionalLight } from "three";
import {
  ENVIRONMENT_MAP_INTENSITY,
  getShadowLightPosition,
  IS_ENVIRONMENT_LIGHTING_ENABLED,
  IS_SCENE_INSPECTOR_ENABLED,
  LIGHT_INTENSITY,
  SHADOW_CAMERA_EXTENT,
  SHADOW_CAMERA_FAR,
  SHADOW_CAMERA_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from "../lib/3d-scene-config";
import { SHIP_MATERIAL_TUNING } from "../lib/scene-material-tuning";
import {
  asSceneRenderer,
  getSceneInspector,
  TONE_MAPPING_EXPOSURE,
} from "../lib/webgpu-renderer";

const SUN_POS = getShadowLightPosition();

/**
 * Live values behind the Inspector's Lights panel.
 *
 * Seeded from the configured defaults, then applied to the scene every frame
 * while the Inspector is on. Once a combination looks right, copy the numbers
 * back into `3d-scene-config.ts` — nothing here persists across a reload.
 */
const LIGHT_TUNING = {
  sun: LIGHT_INTENSITY.sun,
  /** Whether the baked sky probe lights the ship at all. */
  skyLightsShip: IS_ENVIRONMENT_LIGHTING_ENABLED,
  environment: ENVIRONMENT_MAP_INTENSITY,
  exposure: TONE_MAPPING_EXPOSURE,
};

export function SceneLights() {
  const gl = useThree((state) => state.gl);
  const sunRef = useRef<DirectionalLight>(null);

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Lights");
    // The sun is the scene's only light; everything else on the ship comes
    // from the environment probe below.
    panel.add(LIGHT_TUNING, "sun", 0, 20, 0.1);
    // Lights the metal via the baked sky probe, and is not blocked by shadows.
    panel.add(LIGHT_TUNING, "skyLightsShip");
    panel.add(LIGHT_TUNING, "environment", 0, 3, 0.05);
    // Scales the whole image, sky included, unlike the three above.
    panel.add(LIGHT_TUNING, "exposure", 0, 1.5, 0.01);
    // Not a light, but the reason the two fills look inert: the ship is
    // almost entirely metalness 1, and metal has no diffuse response.
    panel.add(SHIP_MATERIAL_TUNING, "metalnessScale", 0, 1, 0.05);
  }, [gl]);

  // Applied per frame rather than through change handlers: it is a handful of
  // assignments, and it cannot drift out of sync with the panel.
  //
  // Scene and renderer come from the frame state rather than `useThree`, which
  // hands back values react-hooks will not let a component mutate.
  useFrame((state) => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    if (sunRef.current) sunRef.current.intensity = LIGHT_TUNING.sun;
    state.scene.environmentIntensity = LIGHT_TUNING.skyLightsShip
      ? LIGHT_TUNING.environment
      : 0;
    asSceneRenderer(state.gl).toneMappingExposure = LIGHT_TUNING.exposure;
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
        intensity={LIGHT_INTENSITY.sun}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-near={SHADOW_CAMERA_NEAR}
        shadow-camera-far={SHADOW_CAMERA_FAR}
        shadow-camera-left={-SHADOW_CAMERA_EXTENT}
        shadow-camera-right={SHADOW_CAMERA_EXTENT}
        shadow-camera-top={SHADOW_CAMERA_EXTENT}
        shadow-camera-bottom={-SHADOW_CAMERA_EXTENT}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
      />
    </>
  );
}
