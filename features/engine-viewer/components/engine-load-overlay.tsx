"use client";

import { useProgress } from "@react-three/drei";

/** Percentage readout over the canvas while the model downloads (~40 MB). */
export function EngineLoadOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/80"
    >
      Loading engine… {Math.round(progress)}%
    </div>
  );
}
