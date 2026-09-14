"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { asSceneRenderer } from "../lib/webgpu-renderer";
import { SCENE_STATS } from "../lib/scene-stats-state";

/**
 * Copies the renderer's per-frame counters into SCENE_STATS. Lives inside the
 * Canvas because that is where `useThree` can reach the renderer; renders
 * nothing.
 *
 * Owns the counter reset. three resets them itself immediately *before* the
 * animation callback, and `useFrame` runs inside that callback, so anything
 * read here would always be a freshly zeroed counter — which is exactly what
 * happened when this first shipped: draw calls and triangles sat at 0 while the
 * scene plainly drew. Turning `autoReset` off and resetting after the read
 * makes each sample cover one whole frame.
 *
 * Deliberately no `renderPriority` argument either. Any value above 0 makes R3F
 * hand the render loop to the caller and stop rendering by itself, blanking the
 * scene while still running at 60 FPS.
 */
export function SceneStatsProbe() {
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    const info = asSceneRenderer(gl).info;
    if (!info) return;

    // Counts accumulated since our own reset below, i.e. the previous frame.
    info.autoReset = false;
    SCENE_STATS.drawCalls = info.render.drawCalls;
    SCENE_STATS.triangles = info.render.triangles;
    SCENE_STATS.geometries = info.memory.geometries;
    SCENE_STATS.textures = info.memory.textures;
    SCENE_STATS.computeCalls = info.compute?.calls ?? 0;
    // DIAGNOSTIC: distinguishes "never counted" from "counted then cleared
    // before we looked".
    SCENE_STATS.autoReset = info.autoReset;
    if (info.render.drawCalls > SCENE_STATS.peakDrawCalls) {
      SCENE_STATS.peakDrawCalls = info.render.drawCalls;
    }

    info.reset();
  });

  return null;
}
