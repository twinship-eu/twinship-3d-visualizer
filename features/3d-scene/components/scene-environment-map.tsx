"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PMREMGenerator, Scene, Vector3, type RenderTarget } from "three/webgpu";
import {
  ENVIRONMENT_MAP_INTENSITY,
  ENVIRONMENT_SKY_OVERRIDES,
  IS_ENVIRONMENT_LIGHTING_ENABLED,
} from "../lib/3d-scene-config";
import {
  asSceneRenderer,
  canAssignEnvironmentProbe,
} from "../lib/webgpu-renderer";
import { probeSunDirection } from "../lib/sky-state";
import { createSky } from "./scene-sky";

/**
 * The sun has moved this far (degrees) since the probe was baked: the probe
 * is baked again, so the ship's metal reflects the sky of the hour — at most
 * once in `MIN_SECONDS_BETWEEN_BAKES`.
 */
const REBAKE_ANGLE_DEG = 3;
const MIN_SECONDS_BETWEEN_BAKES = 2;

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
 * The probe is baked again as the sun moves (`REBAKE_ANGLE_DEG`); the sky's
 * cloud animation is far too slow to justify re-baking per frame.
 *
 * On Android and iOS the bake is skipped entirely: the PMREM samples badly on
 * both (black hull on Mali, flat blue hull on Safari) and the engine ship has
 * no diffuse fallback. See `canAssignEnvironmentProbe`.
 */
export function SceneEnvironmentMap() {
  // `get` rather than `scene`: the scene is mutated here, and react-hooks will
  // not let a component mutate a value a hook handed it directly.
  const get = useThree((state) => state.get);
  /** Bakes the probe for the sun as it is now; null where the probe is skipped. */
  const bake = useRef<(() => void) | null>(null);
  const baked = useRef({ direction: new Vector3(), at: -Infinity });
  const wanted = useRef(new Vector3());

  useEffect(() => {
    const { scene, gl } = get();
    if (!canAssignEnvironmentProbe()) {
      scene.environment = null;
      scene.environmentIntensity = 0;
      return;
    }

    let renderTarget: RenderTarget | null = null;
    bake.current = () => {
      const pmremGenerator = new PMREMGenerator(asSceneRenderer(gl));
      const skyScene = new Scene();
      // Baked from a sky with the sun's glare damped: the directional light
      // already represents the sun, and reflecting its disc as well lit the
      // ship's metal from it twice.
      const sky = createSky(ENVIRONMENT_SKY_OVERRIDES, probeSunDirection());
      skyScene.add(sky);

      const previous = renderTarget;
      renderTarget = pmremGenerator.fromScene(skyScene);
      scene.environment = renderTarget.texture;
      previous?.dispose();

      pmremGenerator.dispose();
      sky.geometry.dispose();
      (sky.material as { dispose: () => void }).dispose();
      probeSunDirection(baked.current.direction);
      baked.current.at = performance.now();
    };
    bake.current();
    // Always assigned, so the Lights panel can switch the contribution back
    // on live; the flag sets the starting strength rather than gating the bake.
    scene.environmentIntensity = IS_ENVIRONMENT_LIGHTING_ENABLED
      ? ENVIRONMENT_MAP_INTENSITY
      : 0;

    return () => {
      bake.current = null;
      scene.environment = null;
      renderTarget?.dispose();
    };
  }, [get]);

  useFrame(() => {
    if (!bake.current) return;
    const { direction, at } = baked.current;
    const moved = (direction.angleTo(probeSunDirection(wanted.current)) * 180) / Math.PI;
    if (moved > REBAKE_ANGLE_DEG && performance.now() - at > MIN_SECONDS_BETWEEN_BAKES * 1000) bake.current();
  });

  return null;
}
