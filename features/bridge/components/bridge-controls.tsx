"use client";

import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/features/cockpit/components/segmented-control";
import { setHudMode, setNight, useBridgeState } from "../lib/bridge-store";

/**
 * Over the scene on the bridge: what the glass shows — every pane, only the
 * alarmed ones, or clear glass — and the night palette, with where the camera is.
 */
export function BridgeControls() {
  const { hudMode, isNight } = useBridgeState();
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2" data-callout-avoid>
      <div className="flex items-center gap-3">
      <span className="text-[12px] font-semibold tracking-[0.12em] text-white/80 drop-shadow">GLASS HUD</span>
      <SegmentedControl
        label="Glass HUD"
        value={hudMode}
        onChange={setHudMode}
        options={[
          { value: "full", label: "Full" },
          { value: "alarms", label: "Alarms only" },
          { value: "clear", label: "Clear glass" },
        ]}
      />
      <button
        type="button"
        onClick={() => setNight(!isNight)}
        aria-pressed={isNight}
        className={cn(
          "pointer-events-auto flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border bg-glass px-3.5 text-[13px] text-ink backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isNight ? "border-warn-line text-warn-ink" : "border-glass-line"
        )}
      >
        <Moon className="size-4" aria-hidden />
        Night
      </button>
      </div>
      <span className="text-[12px] text-white/80 drop-shadow">On the bridge · drag to look round · W A S D or arrows to walk · wheel to zoom · double-click to start over</span>
    </div>
  );
}
