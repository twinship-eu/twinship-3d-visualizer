"use client";

import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { ThemeToggle } from "../components/theme-toggle";

/** Knots above which the ship reads as under way. */
const UNDERWAY_SPEED_KN = 0.5;

/** Below lg, over the tabs' pages: the vessel, how it sails, and that the data is live. */
export function MobileHeader() {
  const snapshot = useLiveData();
  const isUnderway = (snapshot?.navigation.speedOverGroundKn ?? 0) > UNDERWAY_SPEED_KN;

  return (
    <header className="flex shrink-0 items-center gap-3 bg-canvas px-4 pt-3 pb-2 lg:hidden">
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-xl font-bold">TwinShip VESSEL</span>
        <span className="truncate text-[13px] text-muted">
          {isUnderway ? "Underway" : "Stopped"}
          {snapshot && ` · Autonomous ${snapshot.autonomyLevel}`}
        </span>
      </div>
      {snapshot && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1.5">
          <span className="size-2 rounded-full bg-ok" aria-hidden />
          <span className="font-mono text-xs font-semibold tracking-[0.08em] text-ok">LIVE</span>
          <span className="font-mono text-xs text-ink-2" title="UTC">
            {formatUtcTime(snapshot.timestamp).slice(0, 5)}
          </span>
        </span>
      )}
      <ThemeToggle />
    </header>
  );
}
