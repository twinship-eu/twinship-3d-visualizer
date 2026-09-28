"use client";

import { Activity, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewerMode } from "../cockpit-config";

type Props = {
  mode: ViewerMode;
  onChange: (mode: ViewerMode) => void;
  /** Warnings waiting in the live data, counted on its tab while the ontology is shown. */
  activeAlarmCount: number;
};

const OPTIONS: { mode: ViewerMode; label: string; icon: typeof Activity }[] = [
  { mode: "ontology", label: "Ontology", icon: Network },
  { mode: "live", label: "Live data", icon: Activity },
];

/** The top bar's first level: the static ontology, or the ship's live data. */
export function ViewerModeSwitch({ mode, onChange, activeAlarmCount }: Props) {
  return (
    <div
      role="group"
      aria-label="Viewer mode"
      className="flex shrink-0 gap-0.5 rounded-[9px] border border-line bg-seg p-[3px]"
    >
      {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
        const isActive = option === mode;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              isActive
                ? "bg-seg-on font-semibold text-seg-on-ink shadow-[0_1px_2px_rgba(2,8,23,0.15)]"
                : "font-medium text-seg-off hover:text-ink"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {/* The label only from sm up: on a phone the icons carry the switch */}
            <span className="hidden sm:inline">{label}</span>
            {option === "live" && mode !== "live" && activeAlarmCount > 0 && (
              <span
                title={`${activeAlarmCount} active warning${activeAlarmCount === 1 ? "" : "s"}`}
                className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-alarm-badge px-[5px] text-[11px] font-bold text-alarm-badge-ink"
              >
                {activeAlarmCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
