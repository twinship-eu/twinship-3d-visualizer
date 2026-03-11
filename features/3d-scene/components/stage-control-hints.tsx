"use client";

import { cn } from "@/lib/utils";
import {
  MousePointer2,
  Move,
  RotateCw,
  ZoomIn,
} from "lucide-react";

const HINTS = [
  { icon: MousePointer2, label: "Click to select" },
  { icon: RotateCw, label: "Drag to rotate" },
  { icon: Move, label: "Right-drag to pan" },
  { icon: ZoomIn, label: "Scroll to zoom" },
] as const;

export function StageControlHints() {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md bg-white px-4 py-2 shadow-md",
        "pointer-events-none"
      )}
      aria-label="Stage interaction controls"
    >
      {HINTS.map(({ icon: Icon, label }, index) => (
        <div key={label} className="flex items-center gap-2">
          {index > 0 && (
            <span
              className="h-4 w-px bg-gray-200"
              aria-hidden
            />
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-700">
            <Icon className="h-4 w-4 shrink-0 text-primary text-xs" aria-hidden />
            {label}
          </span>
        </div>
      ))}
      <span className="h-4 w-px bg-gray-200" aria-hidden />
      <span className="flex items-center gap-1.5 text-sm text-gray-700">
        <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-600">
          Esc
        </kbd>
        Deselect
      </span>
    </div>
  );
}
