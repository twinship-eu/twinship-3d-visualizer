"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three/webgpu";
import { Scene } from "three";
import {
  ENVIRONMENT_MAP_INTENSITY,
  ENVIRONMENT_SKY_OVERRIDES,
  IS_ENVIRONMENT_LIGHTING_ENABLED,
} from "../lib/3d-scene-config";
import {
  asSceneRenderer,
  canAssignEnvironmentProbe,
} from "../lib/webgpu-renderer";
import { createSky } from "./scene-sky";

/**
 * Bakes the sky into an image-based lighting (IBL) probe and assigns it as
 * `scene.environment`.
 *
 * The ship uses metallic PBR materials, and a metal surface is lit almost
 * entirely by what it reflects. Without an environment map, metalness = 1
 * meshes render black no matter how bright the direct lights are. Baking from
 * the same Sky the camera sees keeps those reflections consistent with the
 * visible horizon.
 *
 * The probe is generated once; the sky's cloud animation is far too slow to
 * justify re-baking per frame.
 *
 * On Android and iOS the bake is skipped entirely: the PMREM samples badly on
 * both (black hull on Mali, flat blue hull on Safari) and the engine ship has
 * no diffuse fallback. See `canAssignEnvironmentProbe`.
 */
export function SceneEnvironmentMap() {
  const { scene, gl } = useThree();

  useEffect(() => {
    if (!canAssignEnvironmentProbe()) {
      scene.environment = null;
      scene.environmentIntensity = 0;
      return;
    }

    const pmremGenerator = new PMREMGenerator(asSceneRenderer(gl));
    const skyScene = new Scene();
    // Baked from a sky with the sun's glare damped: the directional light
    // already represents the sun, and reflecting its disc as well lit the
    // ship's metal from it twice.
    const sky = createSky(ENVIRONMENT_SKY_OVERRIDES);
    skyScene.add(sky);

    const renderTarget = pmremGenerator.fromScene(skyScene);
    scene.environment = renderTarget.texture;
    // Always assigned, so the Lights panel can switch the contribution back
    // on live; the flag sets the starting strength rather than gating the bake.
    scene.environmentIntensity = IS_ENVIRONMENT_LIGHTING_ENABLED
      ? ENVIRONMENT_MAP_INTENSITY
      : 0;

    pmremGenerator.dispose();
    sky.geometry.dispose();
    (sky.material as { dispose: () => void }).dispose();

    return () => {
      scene.environment = null;
      renderTarget.dispose();
    };
  }, [scene, gl]);

  return null;
}
