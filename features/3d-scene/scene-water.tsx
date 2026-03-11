"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Water as ThreeWater } from "three/examples/jsm/objects/Water.js";
import { PlaneGeometry, RepeatWrapping } from "three";
import { useTexture } from "@react-three/drei";
import {
  getSunDirection,
  WATER_PLANE_SIZE,
  WATER_OPTIONS,
  WATER_NORMALS_URL,
} from "./lib/3d-scene-config";

const SUN_DIRECTION = getSunDirection().clone();

function SceneWaterMesh() {
  const { scene } = useThree();
  const waterRef = useRef<ThreeWater>(null);
  const waterNormals = useTexture(WATER_NORMALS_URL);
  waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

  const water = useMemo(() => {
    const geometry = new PlaneGeometry(
      WATER_PLANE_SIZE,
      WATER_PLANE_SIZE
    );
    const w = new ThreeWater(geometry, {
      textureWidth: WATER_OPTIONS.textureWidth,
      textureHeight: WATER_OPTIONS.textureHeight,
      waterNormals,
      sunDirection: SUN_DIRECTION.clone(),
      sunColor: WATER_OPTIONS.sunColor,
      waterColor: WATER_OPTIONS.waterColor,
      distortionScale: WATER_OPTIONS.distortionScale,
      fog: scene.fog !== undefined,
    });
    w.rotation.x = -Math.PI / 2;
    return w;
  }, [scene.fog, waterNormals]);

  useFrame((_, delta) => {
    const w = waterRef.current ?? water;
    const mat = w?.material as { uniforms?: { time?: { value: number }; sunDirection?: { value: typeof SUN_DIRECTION } } } | undefined;
    if (mat?.uniforms?.time) mat.uniforms.time.value += delta;
    if (mat?.uniforms?.sunDirection) mat.uniforms.sunDirection.value.copy(getSunDirection());
  });

  return <primitive ref={waterRef} object={water} position={[0, -5, 0]} />;
}

export function SceneWater() {
  return (
    <Suspense fallback={null}>
      <SceneWaterMesh />
    </Suspense>
  );
}
