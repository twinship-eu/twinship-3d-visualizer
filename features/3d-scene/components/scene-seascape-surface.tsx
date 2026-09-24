"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshBasicNodeMaterial, PlaneGeometry, type Mesh } from "three/webgpu";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import {
  SEASCAPE_SURFACE_GRID_SEGMENTS,
  SEASCAPE_SURFACE_GRID_SIZE,
  SEASCAPE_SURFACE_LEVEL_Y,
  SEASCAPE_SURFACE_SCALE,
} from "../lib/seascape-config";
import {
  createSeascapeSurfaceNodes,
  SEASCAPE_SURFACE_DEFAULTS,
} from "../lib/seascape-surface-tsl";
import { asSceneRenderer, getSceneInspector } from "../lib/webgpu-renderer";

/** World units between adjacent grid vertices. */
const CELL_SIZE = SEASCAPE_SURFACE_GRID_SIZE / SEASCAPE_SURFACE_GRID_SEGMENTS;

/** Rounds to the nearest vertex, so moving the grid never shifts where vertices land. */
function snapToCell(value: number): number {
  return Math.round(value / CELL_SIZE) * CELL_SIZE;
}

/** Builds the grid, its material and the shader's tuning uniforms, once. */
function createSeaSurface() {
  const geometry = new PlaneGeometry(
    SEASCAPE_SURFACE_GRID_SIZE,
    SEASCAPE_SURFACE_GRID_SIZE,
    SEASCAPE_SURFACE_GRID_SEGMENTS,
    SEASCAPE_SURFACE_GRID_SEGMENTS
  );
  geometry.rotateX(-Math.PI / 2);

  const nodes = createSeascapeSurfaceNodes({
    scale: SEASCAPE_SURFACE_SCALE,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
  });
  const material = new MeshBasicNodeMaterial();
  material.positionNode = nodes.positionNode;
  // fragmentNode rather than colorNode: the shader lights itself, and the
  // material's own logic would otherwise apply the scene's environment map.
  material.fragmentNode = nodes.fragmentNode;

  return { geometry, material, uniforms: nodes.uniforms };
}

/**
 * Live values behind the Inspector's Seascape panel, for debugging the sea.
 *
 * Applied to the shader every frame while the Inspector is on. Nothing here
 * persists across a reload — if a value is worth keeping, move it into the
 * shader code.
 */
const SEASCAPE_TUNING = {
  /** Whole relief: the grid's lift and both slopes. */
  waveHeight: SEASCAPE_SURFACE_DEFAULTS.waveHeight,
  /**
   * The fine ripples computed per pixel, relative to the wave height: the
   * ripples are also multiplied by `waveHeight`, so they grow and shrink with
   * the waves.
   */
  ripples: SEASCAPE_SURFACE_DEFAULTS.ripples,
  /** Fade octaves too fine for the pixel. Off to compare against no fix. */
  antiAliasing: true,
  /** How much sky edge-on water reflects. */
  reflectivity: SEASCAPE_SURFACE_DEFAULTS.reflectivity,
};

/** Lowest wave height the panel allows: below it the sea reads as a flat plane. */
const MIN_WAVE_HEIGHT = 0.25;

/**
 * The "Seascape" sea as real geometry: a grid displaced by the shader's wave
 * function, so the ship's hull can go under the surface.
 *
 * Experimental counterpart of `SceneSeascape`; switch between them with
 * `IS_SEASCAPE_SURFACE_ENABLED`.
 */
export function SceneSeascapeSurface() {
  const gl = useThree((state) => state.gl);
  const meshRef = useRef<Mesh>(null);

  // Held in a ref, not a memo: the uniforms are written every frame, and the
  // React Compiler rightly refuses mutating a memoised value. A lazily filled
  // ref is the sanctioned escape hatch.
  const seaRef = useRef<ReturnType<typeof createSeaSurface> | null>(null);
  seaRef.current ??= createSeaSurface();
  const { geometry, material } = seaRef.current;

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Seascape");
    panel.add(SEASCAPE_TUNING, "waveHeight", MIN_WAVE_HEIGHT, 2, 0.01);
    panel.add(SEASCAPE_TUNING, "ripples", 0, 3, 0.01);
    panel.add(SEASCAPE_TUNING, "antiAliasing");
    panel.add(SEASCAPE_TUNING, "reflectivity", 0, 1, 0.01);
  }, [gl]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Keep the grid under the camera. The waves are computed in world space,
    // so they stay put while the grid moves beneath them.
    mesh.position.x = snapToCell(camera.position.x);
    mesh.position.z = snapToCell(camera.position.z);

    // Applied per frame rather than through change handlers, as SceneLights
    // does: a few assignments, and it cannot drift out of sync with the panel.
    const sea = seaRef.current;
    if (!IS_SCENE_INSPECTOR_ENABLED || !sea) return;
    sea.uniforms.waveHeight.value = SEASCAPE_TUNING.waveHeight;
    sea.uniforms.ripples.value = SEASCAPE_TUNING.ripples;
    sea.uniforms.antiAliasing.value = SEASCAPE_TUNING.antiAliasing ? 1.0 : 0.0;
    sea.uniforms.reflectivity.value = SEASCAPE_TUNING.reflectivity;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, SEASCAPE_SURFACE_LEVEL_Y, 0]}
    />
  );
}
