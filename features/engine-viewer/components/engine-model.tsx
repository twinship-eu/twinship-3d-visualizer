"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { getMaxTextureAnisotropy } from "@/features/3d-scene/lib/webgpu-renderer";
import { withKtx2Textures } from "@/features/ship-visualizer/lib/ktx2-loader";
import { applyTextureAnisotropy } from "@/features/ship-visualizer/lib/3d-model";
import { ENGINE_MODEL_PATH, ENGINE_NODE_NAME } from "../engine-viewer-config";
import { extractEngine } from "../lib/extract-engine";
import { EngineCameraRig } from "./engine-camera-rig";
import { EngineLights } from "./engine-lights";

/** Loads the ship, keeps its engine, and frames the camera and lights around it. */
export function EngineModel() {
  const gl = useThree((state) => state.gl);
  const maxAnisotropy = useThree((state) => getMaxTextureAnisotropy(state.gl));
  // Textures may be KTX2, GPU-compressed (see `withKtx2Textures`)
  const gltf = useGLTF(ENGINE_MODEL_PATH, undefined, undefined, withKtx2Textures(gl));

  const { root, radius } = useMemo(() => {
    const extracted = extractEngine(gltf.scene, ENGINE_NODE_NAME);
    applyTextureAnisotropy(extracted.root, maxAnisotropy);
    return extracted;
  }, [gltf.scene, maxAnisotropy]);

  return (
    <>
      <EngineLights radius={radius} />
      <EngineCameraRig radius={radius} />
      <primitive object={root} />
    </>
  );
}
