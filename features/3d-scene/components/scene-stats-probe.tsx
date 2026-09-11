"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { asSceneRenderer } from "../lib/webgpu-renderer";
import { SCENE_STATS } from "../lib/scene-stats-state";

/**
 * Copies the renderer's per-frame counters into SCENE_STATS. Lives inside the
 * Canvas because that is where `useThree` can reach the renderer; renders
 * nothing.
 *
 * `renderPriority` 1 runs this after the default frame work, so the counters
 * read are the ones the frame actually finished with rather than a half-built
 * tally.
 */
export function SceneStatsProbe() {
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    const info = asSceneRenderer(gl).info;
    if (!info) return;
    SCENE_STATS.drawCalls = info.render.drawCalls;
    SCENE_STATS.triangles = info.render.triangles;
    SCENE_STATS.geometries = info.memory.geometries;
    SCENE_STATS.textures = info.memory.textures;
    SCENE_STATS.computeCalls = info.compute?.calls ?? 0;
  }, 1);

  return null;
}
