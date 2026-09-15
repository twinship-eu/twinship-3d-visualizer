"use client";

import { cn } from "@/lib/utils";
import {
  Hand,
  Move,
  MousePointer2,
  Pointer,
  RotateCw,
  ZoomIn,
} from "lucide-react";

type Hint = {
  icon: typeof MousePointer2;
  label: string;
};

/** Pointer and keyboard gestures, shown at `lg` and above. */
const DESKTOP_HINTS: Hint[] = [
  { icon: MousePointer2, label: "Click to select" },
  { icon: RotateCw, label: "Drag to rotate" },
  { icon: Move, label: "Right-drag to pan" },
  { icon: ZoomIn, label: "Scroll to zoom" },
];

/**
 * Touch gestures, shown below `lg`.
 *
 * These are OrbitControls' touch defaults: one finger orbits, two fingers
 * dolly and pan together. The Escape hint has no mobile counterpart, since
 * there is no keyboard -- the details sheet is dismissed with its own close
 * button instead.
 */
const TOUCH_HINTS: Hint[] = [
  { icon: Pointer, label: "Tap to select" },
  { icon: RotateCw, label: "Drag to rotate" },
  { icon: Hand, label: "Two fingers to pan" },
  { icon: ZoomIn, label: "Pinch to zoom" },
];

function HintList({ hints }: { hints: Hint[] }) {
  return (
    <>
      {hints.map(({ icon: Icon, label }, index) => (
        <div key={label} className="flex shrink-0 items-center gap-2">
          {index > 0 && <span className="h-4 w-px bg-gray-200" aria-hidden />}
          <span className="flex items-center gap-1.5 text-xs text-gray-700">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {label}
          </span>
        </div>
      ))}
    </>
  );
}

export function StageControlHints() {
  return (
    <>
      {/*
        Below lg: spans the width and scrolls sideways, since the hint row is
        wider than a phone. pointer-events must be on for that scroll to be
        possible -- an element that ignores pointer events cannot be swiped.
      */}
      <div
        className={cn(
          "pointer-events-auto absolute inset-x-2 bottom-4 z-10 flex items-center gap-2",
          "overflow-x-auto whitespace-nowrap rounded-md bg-white px-4 py-2 shadow-md",
          "lg:hidden"
        )}
        aria-label="Stage touch controls"
      >
        <HintList hints={TOUCH_HINTS} />
      </div>

      {/* At lg: the fixed-width centred bar, unchanged. */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-4 left-1/2 z-10 hidden w-[630px]",
          "-translate-x-1/2 items-center gap-2 rounded-md bg-white px-4 py-2 shadow-md",
          "lg:flex"
        )}
        aria-label="Stage interaction controls"
      >
        <HintList hints={DESKTOP_HINTS} />
        <span className="h-4 w-px shrink-0 bg-gray-200" aria-hidden />
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-gray-700">
          <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-600">
            Esc
          </kbd>
          Deselect
        </span>
      </div>
    </>
  );
}
