"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator, Scene } from "three";
import { ENVIRONMENT_MAP_INTENSITY } from "../lib/3d-scene-config";
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
 */
export function SceneEnvironmentMap() {
  const { scene, gl } = useThree();

  useEffect(() => {
    const pmremGenerator = new PMREMGenerator(gl);
    const skyScene = new Scene();
    const sky = createSky();
    skyScene.add(sky);

    const renderTarget = pmremGenerator.fromScene(skyScene);
    scene.environment = renderTarget.texture;
    scene.environmentIntensity = ENVIRONMENT_MAP_INTENSITY;

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
