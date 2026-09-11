"use client";

import { useEffect, useState } from "react";
import { SCENE_STATS } from "../lib/scene-stats-state";

/** Refresh rate of the readout. Slow enough to stay legible while orbiting. */
const REFRESH_MS = 250;

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

type Row = { label: string; value: number };

/**
 * Development-only readout of what the renderer actually drew last frame.
 *
 * Answers the question the three.js Inspector does not: how much geometry is
 * on screen. Its Performance tab reports FPS and CPU/GPU timings only.
 *
 * Reads from a shared mutable on an interval rather than subscribing to the
 * frame loop, so the readout itself costs four renders a second instead of
 * sixty.
 *
 * Reading it: draw calls and triangles that barely move while the frame rate
 * collapses mean the cost is per-pixel, not per-triangle — overdraw, oversized
 * textures, or an extra full-scene pass such as the water's planar reflector.
 * Counts that jump with the camera mean the opposite.
 */
export function SceneStatsOverlay() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const read = () =>
      setRows([
        { label: "draw calls", value: SCENE_STATS.drawCalls },
        { label: "triangles", value: SCENE_STATS.triangles },
        { label: "geometries", value: SCENE_STATS.geometries },
        { label: "textures", value: SCENE_STATS.textures },
        { label: "compute", value: SCENE_STATS.computeCalls },
      ]);
    read();
    const timer = window.setInterval(read, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-4 left-20 z-20 rounded bg-black/60 px-2 py-1 font-mono text-[10px] leading-tight text-white">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-3">
          <span className="text-white/60">{row.label}</span>
          <span className="tabular-nums">
            {NUMBER_FORMAT.format(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
