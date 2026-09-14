"use client";

import { Suspense, useMemo } from "react";
import { WaterMesh } from "three/examples/jsm/objects/WaterMesh.js";
import { Color, PlaneGeometry, RepeatWrapping } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { useTexture } from "@react-three/drei";
import {
  getSunDirection,
  IS_WATER_REFLECTION_ENABLED,
  WATER_NORMALS_URL,
  WATER_OPTIONS,
  WATER_PLANE_SIZE,
  WATER_RESOLUTION_SCALE,
} from "../lib/3d-scene-config";

/** Height of the ocean plane, below the ship's own vertical offset. */
const WATER_Y = -5;

/** Roughness of the non-reflective water. Low enough to still catch the sky. */
const FLAT_WATER_ROUGHNESS = 0.15;
/** Metalness of the non-reflective water, so the environment probe shows. */
const FLAT_WATER_METALNESS = 0.6;

function SceneWaterMesh() {
  const waterNormals = useTexture(WATER_NORMALS_URL);
  waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

  const water = useMemo(() => {
    const geometry = new PlaneGeometry(WATER_PLANE_SIZE, WATER_PLANE_SIZE);
    const mesh = new WaterMesh(geometry, {
      waterNormals,
      sunDirection: getSunDirection(),
      sunColor: WATER_OPTIONS.sunColor,
      waterColor: WATER_OPTIONS.waterColor,
      distortionScale: WATER_OPTIONS.distortionScale,
      resolutionScale: WATER_RESOLUTION_SCALE,
    });
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }, [waterNormals]);

  // Deliberately does not receive shadows: the reflection already carries the
  // ship, and WaterMesh is built on a plain NodeMaterial, which is unlit and
  // cannot receive one anyway.
  return <primitive object={water} position={[0, WATER_Y, 0]} />;
}

/**
 * Water without planar reflections: the same plane at the same height, lit by
 * the scene's environment probe instead of by a second render of the scene.
 *
 * Drops the `Scene [ Reflector ]` pass entirely, which is what makes it worth
 * having — the ship stops being rasterised twice per frame.
 */
function FlatWaterMesh() {
  const material = useMemo(() => {
    return new MeshStandardNodeMaterial({
      color: new Color(WATER_OPTIONS.waterColor),
      roughness: FLAT_WATER_ROUGHNESS,
      metalness: FLAT_WATER_METALNESS,
    });
  }, []);

  return (
    <mesh
      material={material}
      position={[0, WATER_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[WATER_PLANE_SIZE, WATER_PLANE_SIZE]} />
    </mesh>
  );
}

export function SceneWater() {
  if (!IS_WATER_REFLECTION_ENABLED) {
    return <FlatWaterMesh />;
  }

  return (
    <Suspense fallback={null}>
      <SceneWaterMesh />
    </Suspense>
  );
}
