"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import { SEASCAPE_ATMOSPHERE } from "../lib/seascape-config";
import { createSeascapeAtmosphereNodes } from "../lib/seascape-atmosphere-tsl";
import { asSceneRenderer, getSceneInspector } from "../lib/webgpu-renderer";

/**
 * Live values behind the Inspector's Atmosphere panel.
 *
 * Applied every frame while the Inspector is on; nothing persists across a
 * reload. Values worth keeping belong in `SEASCAPE_ATMOSPHERE`.
 */
const ATMOSPHERE_TUNING = {
  horizonColor: SEASCAPE_ATMOSPHERE.horizonColor as string,
  hazeStart: SEASCAPE_ATMOSPHERE.hazeStart as number,
  hazeEnd: SEASCAPE_ATMOSPHERE.hazeEnd as number,
  skyHazeHeight: SEASCAPE_ATMOSPHERE.skyHazeHeight as number,
};

/**
 * The sky behind the surface sea and the haze that joins the two, so the sea
 * fades into the horizon instead of ending at an edge.
 *
 * Sets `scene.backgroundNode` and `scene.fogNode`, and puts back whatever was
 * there before when it unmounts.
 */
export function SceneSeascapeAtmosphere() {
  // `get` rather than `scene`: the scene is mutated here, and react-hooks will
  // not let a component mutate a value a hook handed it directly.
  const get = useThree((state) => state.get);

  // Held in a ref, not a memo: the uniforms are written every frame.
  const atmosphereRef = useRef<ReturnType<typeof createSeascapeAtmosphereNodes> | null>(null);
  atmosphereRef.current ??= createSeascapeAtmosphereNodes(SEASCAPE_ATMOSPHERE);
  const atmosphere = atmosphereRef.current;

  useEffect(() => {
    const { scene } = get();
    const previousBackground = scene.backgroundNode;
    const previousFog = scene.fogNode;

    scene.backgroundNode = atmosphere.backgroundNode;
    scene.fogNode = atmosphere.fogNode;

    return () => {
      scene.backgroundNode = previousBackground;
      scene.fogNode = previousFog;
    };
  }, [get, atmosphere]);

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(get().gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Atmosphere");
    panel.addColor(ATMOSPHERE_TUNING, "horizonColor");
    panel.add(ATMOSPHERE_TUNING, "hazeStart", 0, SEASCAPE_ATMOSPHERE.maxHazeEnd, 1);
    panel.add(ATMOSPHERE_TUNING, "hazeEnd", 0, SEASCAPE_ATMOSPHERE.maxHazeEnd, 1);
    panel.add(ATMOSPHERE_TUNING, "skyHazeHeight", 0, 1, 0.01);
  }, [get]);

  // Applied per frame, as SceneLights does: a few assignments, and it cannot
  // drift out of sync with the panel.
  useFrame(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const { uniforms } = atmosphere;
    uniforms.horizonColor.value.set(ATMOSPHERE_TUNING.horizonColor);
    uniforms.hazeStart.value = ATMOSPHERE_TUNING.hazeStart;
    uniforms.hazeEnd.value = ATMOSPHERE_TUNING.hazeEnd;
    uniforms.skyHazeHeight.value = ATMOSPHERE_TUNING.skyHazeHeight;
  });

  return null;
}
