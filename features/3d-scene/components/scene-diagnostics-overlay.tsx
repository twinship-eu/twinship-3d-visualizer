"use client";

import { useEffect, useState } from "react";
import { SCENE_DIAGNOSTICS } from "../lib/scene-diagnostics";

/** How often the readout re-renders, in ms. Slow: it is read by eye. */
const REFRESH_MS = 500;

/**
 * Prints the diagnostics on the page, for a device whose console cannot be
 * reached. Sized and coloured to survive being photographed off a phone screen.
 */
export function SceneDiagnosticsOverlay() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const rows: [string, string][] = [
    ["backend", SCENE_DIAGNOSTICS.backend],
    ["environment", SCENE_DIAGNOSTICS.hasEnvironment],
    ["shadows", SCENE_DIAGNOSTICS.shadowsEnabled],
    ["depthCompare", SCENE_DIAGNOSTICS.depthCompare],
    ["buffer", SCENE_DIAGNOSTICS.drawingBufferSize],
    ["envIntensity", SCENE_DIAGNOSTICS.environmentIntensity],
    ["envSize", SCENE_DIAGNOSTICS.environmentSize],
    ["tone", SCENE_DIAGNOSTICS.toneMapping],
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] max-h-[55vh] overflow-y-auto bg-black/85 p-2 font-mono text-[10px] leading-snug text-lime-300">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span className="text-lime-500">{label}:</span> {value}
        </div>
      ))}
      <div className="mt-1 text-lime-500">materials:</div>
      {SCENE_DIAGNOSTICS.materials.length === 0 && <div>(none read)</div>}
      {SCENE_DIAGNOSTICS.materials.map((line) => (
        <div key={line} className="break-words text-cyan-300">
          {line}
        </div>
      ))}
      <div className="mt-1 text-lime-500">
        console: showing {SCENE_DIAGNOSTICS.lines.length} of{" "}
        {SCENE_DIAGNOSTICS.totalCaptured} total
      </div>
      {SCENE_DIAGNOSTICS.lines.length === 0 && <div>(none)</div>}
      {SCENE_DIAGNOSTICS.lines.map((line, index) => (
        <div key={index} className="break-words text-amber-300">
          {index + 1}. {line}
        </div>
      ))}
    </div>
  );
}
