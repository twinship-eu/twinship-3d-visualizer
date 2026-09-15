"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { asSceneRenderer, isWebGPUBackend } from "../lib/webgpu-renderer";
import { SCENE_DIAGNOSTICS } from "../lib/scene-diagnostics";

/**
 * Delay before reading the scene, in ms.
 *
 * The environment probe is baked in an effect that renders the sky through
 * PMREMGenerator, so reading `scene.environment` on the same tick would report
 * a null that is merely early rather than wrong.
 */
const READ_DELAY_MS = 1500;

/** three's `Compatibility.TEXTURE_COMPARE` key; not re-exported from three/webgpu. */
const DEPTH_TEXTURE_COMPARE = "depthTextureCompare";

/**
 * Reads renderer and scene state into SCENE_DIAGNOSTICS.
 *
 * Inside the Canvas, because that is where `useThree` reaches the renderer.
 * Renders nothing.
 */
export function SceneDiagnosticsProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const timer = setTimeout(() => {
      const renderer = asSceneRenderer(gl);

      SCENE_DIAGNOSTICS.backend = isWebGPUBackend(gl) ? "WebGPU" : "WebGL2";
      SCENE_DIAGNOSTICS.hasEnvironment =
        scene.environment === null || scene.environment === undefined
          ? "NULL  <- metal renders black"
          : "set";
      SCENE_DIAGNOSTICS.shadowsEnabled = String(
        renderer.shadowMap?.enabled ?? "unknown"
      );

      try {
        SCENE_DIAGNOSTICS.depthCompare = String(
          renderer.hasCompatibility(DEPTH_TEXTURE_COMPARE)
        );
      } catch {
        SCENE_DIAGNOSTICS.depthCompare = "unavailable";
      }

      const size = renderer.getDrawingBufferSize(new Vector2());
      SCENE_DIAGNOSTICS.drawingBufferSize = `${Math.round(
        size.width
      )}x${Math.round(size.height)}`;
    }, READ_DELAY_MS);

    return () => clearTimeout(timer);
  }, [gl, scene]);

  return null;
}
