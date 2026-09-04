"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { isWebGPUBackend } from "../lib/webgpu-renderer";

type Props = {
  onResolved: (isWebGPU: boolean) => void;
};

/**
 * Reports which backend the renderer resolved to. Lives inside the Canvas
 * because that is where `useThree` can reach the renderer; renders nothing.
 */
export function RendererBackendProbe({ onResolved }: Props) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    onResolved(isWebGPUBackend(gl));
  }, [gl, onResolved]);

  return null;
}
