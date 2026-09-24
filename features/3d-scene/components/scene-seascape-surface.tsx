"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshBasicNodeMaterial, PlaneGeometry, type Mesh } from "three/webgpu";
import {
  SEASCAPE_SURFACE_GRID_SEGMENTS,
  SEASCAPE_SURFACE_GRID_SIZE,
  SEASCAPE_SURFACE_LEVEL_Y,
  SEASCAPE_SURFACE_SCALE,
} from "../lib/seascape-config";
import { createSeascapeSurfaceNodes } from "../lib/seascape-surface-tsl";

/** World units between adjacent grid vertices. */
const CELL_SIZE = SEASCAPE_SURFACE_GRID_SIZE / SEASCAPE_SURFACE_GRID_SEGMENTS;

/** Rounds to the nearest vertex, so moving the grid never shifts where vertices land. */
function snapToCell(value: number): number {
  return Math.round(value / CELL_SIZE) * CELL_SIZE;
}

/**
 * The "Seascape" sea as real geometry: a grid displaced by the shader's wave
 * function, so the ship's hull can go under the surface.
 *
 * Experimental counterpart of `SceneSeascape`; switch between them with
 * `IS_SEASCAPE_SURFACE_ENABLED`.
 */
export function SceneSeascapeSurface() {
  const meshRef = useRef<Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const grid = new PlaneGeometry(
      SEASCAPE_SURFACE_GRID_SIZE,
      SEASCAPE_SURFACE_GRID_SIZE,
      SEASCAPE_SURFACE_GRID_SEGMENTS,
      SEASCAPE_SURFACE_GRID_SEGMENTS
    );
    grid.rotateX(-Math.PI / 2);

    const { positionNode, fragmentNode } = createSeascapeSurfaceNodes({
      scale: SEASCAPE_SURFACE_SCALE,
      levelY: SEASCAPE_SURFACE_LEVEL_Y,
    });
    const seaMaterial = new MeshBasicNodeMaterial();
    seaMaterial.positionNode = positionNode;
    // fragmentNode rather than colorNode: the shader lights itself, and the
    // material's own logic would otherwise apply the scene's environment map.
    seaMaterial.fragmentNode = fragmentNode;

    return { geometry: grid, material: seaMaterial };
  }, []);

  // Keep the grid under the camera. The waves are computed in world space, so
  // they stay put while the grid moves beneath them.
  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.x = snapToCell(camera.position.x);
    mesh.position.z = snapToCell(camera.position.z);
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
