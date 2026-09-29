"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, acknowledgeAlarm, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { PANE_SYSTEM_INFO, type PaneSystem } from "../bridge-config";
import { assignPane, useBridgeState } from "../lib/bridge-store";

const DRAG_TYPE = "application/x-twinship-pane-system";

/** Each system's dot, in its section's colour. */
const SYSTEM_DOTS: Record<PaneSystem, string> = {
  energy: "bg-system-energy",
  wind: "bg-system-hull",
  nav: "",
  hull: "bg-system-hull",
  propulsion: "bg-system-propeller",
};

/**
 * Under the scene on the bridge: the five panes, the system each shows, and
 * its state — a pane with an alarm turns amber, with the way to acknowledge
 * it. A system dragged onto another pane swaps places with the one there.
 */
export function BridgePaneStrip() {
  const { panes, hudMode } = useBridgeState();
  const snapshot = useLiveData();
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  return (
    <section aria-label="Bridge panes" className="hidden h-[170px] shrink-0 grid-cols-5 gap-3 border-t border-line bg-surface px-4 py-3.5 lg:grid">
      {panes.map((system, index) => {
        const info = PANE_SYSTEM_INFO[system];
        const alarm = info.componentLabel && snapshot ? activeAlarmOn(snapshot, info.componentLabel) : null;
        const isHidden = hudMode === "clear" || (hudMode === "alarms" && !alarm);
        return (
          <div
            key={system}
            draggable
            onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, system)}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(index);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDropTarget(null);
              const dropped = event.dataTransfer.getData(DRAG_TYPE) as PaneSystem;
              if (dropped) assignPane(index, dropped);
            }}
            className={cn(
              "flex cursor-grab flex-col justify-between rounded-[10px] border bg-card px-4 py-3.5 active:cursor-grabbing",
              alarm ? "border-warn-line bg-warn-soft" : "border-line",
              system === "nav" && !alarm && "border-accent-line",
              dropTarget === index && "ring-2 ring-accent"
            )}
          >
            <span className={cn("font-mono text-[13px]", alarm ? "text-warn-ink" : system === "nav" ? "text-accent-ink" : "text-muted")}>
              P{index + 1}
              {alarm ? " · warning" : system === "nav" ? " · kept clear" : ""}
              {isHidden && !alarm ? " · hidden" : ""}
            </span>
            <span className="flex items-center gap-2 text-[16px] font-semibold">
              {SYSTEM_DOTS[system] && <span className={cn("size-2 rounded-full", SYSTEM_DOTS[system])} aria-hidden />}
              {info.label}
            </span>
            {alarm && !alarm.isAcknowledged ? (
              <button type="button" onClick={() => acknowledgeAlarm(alarm.id)} className="cursor-pointer self-start text-[13px] font-semibold text-warn-ink hover:underline">
                Acknowledge →
              </button>
            ) : (
              <span className="text-[12px] text-muted">{system === "nav" ? "Heading, speed, course only" : "Drag a system here to reassign"}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
