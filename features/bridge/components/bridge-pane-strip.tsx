"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, acknowledgeAlarm, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { PANE_SYSTEM_INFO, type PaneSystem } from "../bridge-config";
import { moveToWindow, useBridgeState } from "../lib/bridge-store";

const DRAG_TYPE = "application/x-twinship-hud-system";
const WINDOW_NAMES = ["Left front window", "Right front window"] as const;

/** Each system's dot, in its section's colour; navigation has none. */
const SYSTEM_DOTS: Record<PaneSystem, string> = {
  energy: "bg-system-energy",
  wind: "bg-system-hull",
  nav: "bg-accent",
  hull: "bg-system-hull",
  propulsion: "bg-system-propeller",
};

/**
 * Under the scene on the bridge: the two HUD windows and the systems on each,
 * with their state — an alarmed one amber, to acknowledge from here. A system
 * dragged onto the other window moves there.
 */
export function BridgePaneStrip() {
  const { windows, hudMode } = useBridgeState();
  const snapshot = useLiveData();
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  return (
    <section aria-label="Bridge HUD windows" className="hidden h-[170px] shrink-0 grid-cols-2 gap-3 border-t border-line bg-surface px-4 py-3.5 lg:grid">
      {windows.map((systems, windowIndex) => (
        <div
          key={WINDOW_NAMES[windowIndex]}
          onDragOver={(event) => {
            event.preventDefault();
            setDropTarget(windowIndex);
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(event) => {
            event.preventDefault();
            setDropTarget(null);
            const system = event.dataTransfer.getData(DRAG_TYPE) as PaneSystem;
            if (system) moveToWindow(system, windowIndex);
          }}
          className={cn("flex flex-col gap-2.5 rounded-[10px] border border-line bg-card px-4 py-3", dropTarget === windowIndex && "ring-2 ring-accent")}
        >
          <span className="flex justify-between font-mono text-[12px] text-muted">
            <span>{WINDOW_NAMES[windowIndex].toUpperCase()}</span>
            <span>{hudMode === "full" ? "all shown" : hudMode === "alarms" ? "alarms only" : "clear glass"}</span>
          </span>
          <div className="flex min-h-0 grow flex-wrap content-start gap-2">
            {systems.map((system) => {
              const info = PANE_SYSTEM_INFO[system];
              const alarm = info.componentLabel && snapshot ? activeAlarmOn(snapshot, info.componentLabel) : null;
              return (
                <div
                  key={system}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, system)}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-[14px] font-semibold active:cursor-grabbing",
                    alarm ? "border-warn-line bg-warn-soft text-warn-ink" : "border-line-strong"
                  )}
                >
                  <span className={cn("size-2 rounded-full", SYSTEM_DOTS[system])} aria-hidden />
                  {info.label}
                  {alarm && !alarm.isAcknowledged && (
                    <button type="button" onClick={() => acknowledgeAlarm(alarm.id)} className="ml-1 cursor-pointer text-[12px] font-semibold underline">
                      Acknowledge
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[12px] text-muted">Drag a system onto the other window to move it</span>
        </div>
      ))}
    </section>
  );
}
