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
          {index > 0 && <span className="h-4 w-px bg-line" aria-hidden />}
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <Icon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
            {label}
          </span>
        </div>
      ))}
    </>
  );
}

export function StageControlHints({
  isDetailsOpen = false,
  isHiddenBelowLg = false,
}: {
  /** Hides the touch hints below lg: the scene is a card there, among other content. */
  isHiddenBelowLg?: boolean;
  /**
   * Hides the hints while a component's details are open: below lg the sheet
   * would cover them, at lg its card runs down beside them.
   */
  isDetailsOpen?: boolean;
}) {
  return (
    <>
      {/*
        Below lg: spans the width and scrolls sideways, since the hint row is
        wider than a phone. pointer-events must be on for that scroll to be
        possible -- an element that ignores pointer events cannot be swiped.
      */}
      <div
        className={cn(
          "pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2",
          // Shrinks to its content rather than spanning the viewport, so there
          // is no empty white strip beside the last hint. Still scrolls when
          // the hints are wider than the screen.
          "w-fit max-w-[calc(100vw-1rem)] overflow-x-auto whitespace-nowrap",
          "rounded-lg border border-glass-line bg-glass px-4 py-2 backdrop-blur",
          // The sheet covers this space, and orbit hints are not what anyone is
          // reading while a component's details are open.
          (isDetailsOpen || isHiddenBelowLg) && "hidden",
          "lg:hidden"
        )}
        aria-label="Stage touch controls"
      >
        <HintList hints={TOUCH_HINTS} />
      </div>

      {/* At lg: the fixed-width centred bar, unchanged. */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-4 left-1/2 z-10 hidden w-fit",
          "-translate-x-1/2 items-center gap-2 rounded-lg border border-glass-line bg-glass px-4 py-2 backdrop-blur",
          !isDetailsOpen && "lg:flex"
        )}
        aria-label="Stage interaction controls"
      >
        <HintList hints={DESKTOP_HINTS} />
        <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-2">
          <kbd className="rounded border border-line-strong bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted">
            Esc
          </kbd>
          Deselect
        </span>
      </div>
    </>
  );
}
