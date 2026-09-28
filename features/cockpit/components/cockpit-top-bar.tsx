"use client";

import { Ship, TriangleAlert } from "lucide-react";
import { getActiveAlarms, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import type { Alarm, LiveSnapshot } from "@/features/live-data/live-data-types";
import { COCKPIT_BRAND, type ViewerMode } from "../cockpit-config";
import { NavigationReadouts } from "./navigation-readouts";
import { ThemeToggle } from "./theme-toggle";
import { ViewerModeSwitch } from "./viewer-mode-switch";

type Props = {
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  /** Opens an active warning: the badge's action, on the first of them. */
  onOpenAlarm: (alarm: Alarm) => void;
};

/** Whether the snapshot comes from the simulation or the ship, and how often. */
function sourceLabel(snapshot: LiveSnapshot) {
  return `${snapshot.origin === "simulated" ? "SIM" : "STREAM"} · ${snapshot.rateHz} Hz`;
}

/**
 * The cockpit's top bar: who and what, the viewer mode, and — in Live data —
 * the ship's readings, its autonomy, the data's source and the time. The
 * warning badge and the theme toggle in both modes.
 *
 * Reads the live data itself, so its once-a-second updates re-render only the bar.
 */
export function CockpitTopBar({ mode, onModeChange, onOpenAlarm }: Props) {
  const snapshot = useLiveData();
  const activeAlarms = getActiveAlarms(snapshot);
  const activeAlarmCount = activeAlarms.length;
  const isLive = mode === "live";

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-4 whitespace-nowrap border-b border-line bg-surface px-4">
      <div className="flex shrink-0 items-center gap-2.5 lg:w-[248px]">
        <Ship className="size-[22px] shrink-0 text-sim" aria-hidden />
        <div className="hidden flex-col leading-[1.1] sm:flex">
          <span className="text-[13px] font-bold tracking-[0.12em]">{COCKPIT_BRAND.title}</span>
          <span className="text-[11px] text-muted">{COCKPIT_BRAND.subtitle}</span>
        </div>
      </div>

      <ViewerModeSwitch mode={mode} onChange={onModeChange} activeAlarmCount={activeAlarmCount} />

      {isLive ? (
        <NavigationReadouts navigation={snapshot?.navigation ?? null} />
      ) : (
        <span className="hidden text-[13px] text-muted xl:inline">{COCKPIT_BRAND.ontologyCaption}</span>
      )}

      <div className="grow" />

      {activeAlarms[0] && (
        <button
          type="button"
          onClick={() => onOpenAlarm(activeAlarms[0])}
          aria-label={`${activeAlarmCount} active warning${activeAlarmCount === 1 ? "" : "s"}`}
          className="flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-alarm-badge px-2.5 text-[13px] font-bold text-alarm-badge-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <TriangleAlert className="size-4" aria-hidden />
          {activeAlarmCount}
        </button>
      )}

      {isLive && snapshot && (
        <>
          <span className="hidden h-[30px] shrink-0 items-center rounded-md border border-accent-line px-2.5 text-xs font-semibold tracking-[0.08em] text-accent-ink lg:flex">
            AUTO · {snapshot.autonomyLevel}
          </span>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <span className="size-2 rounded-full bg-ok shadow-[0_0_0_3px_var(--color-ok-soft)]" aria-hidden />
            <span className="text-xs font-bold tracking-[0.1em]">LIVE</span>
            <span className="hidden font-mono text-[11px] text-muted 2xl:inline">{sourceLabel(snapshot)}</span>
          </div>
          <div className="hidden h-[38px] shrink-0 items-center gap-1.5 border-l border-line pl-4 xl:flex">
            <span className="font-mono text-[15px] font-semibold tabular-nums">{formatUtcTime(snapshot.timestamp)}</span>
            <span className="text-[11px] text-muted">UTC</span>
          </div>
        </>
      )}

      <ThemeToggle />
    </header>
  );
}
