"use client";

import { Suspense, useMemo } from "react";
import { WaterMesh } from "three/examples/jsm/objects/WaterMesh.js";
import { PlaneGeometry, RepeatWrapping } from "three";
import { useTexture } from "@react-three/drei";
import {
  getSunDirection,
  WATER_NORMALS_URL,
  WATER_OPTIONS,
  WATER_PLANE_SIZE,
  WATER_RESOLUTION_SCALE,
} from "../lib/3d-scene-config";

/** Height of the ocean plane, below the ship's own vertical offset. */
const WATER_Y = -5;

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

  return <primitive object={water} position={[0, WATER_Y, 0]} />;
}

export function SceneWater() {
  return (
    <Suspense fallback={null}>
      <SceneWaterMesh />
    </Suspense>
  );
}
