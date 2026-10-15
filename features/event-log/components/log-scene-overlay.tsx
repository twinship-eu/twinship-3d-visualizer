"use client";

import { ListChecks } from "lucide-react";
import { IS_TIME_SERIES_DRAWER_ENABLED } from "../event-log-config";
import { useEventLogState } from "../lib/event-log-store";
import { TimeSeriesDrawer } from "./time-series-drawer";

type Props = {
  /** Whether the event log is open beside the scene. */
  isLogOpen: boolean;
  /** Opens or closes it: the tab on the scene's right edge. */
  onToggleLog: () => void;
};

/**
 * Over the scene in Live data: the tab on its right edge that opens and
 * closes the event log. (A selected event's component is shown by its
 * callout on the ship, not by a chip over it.)
 */
export function LogSceneOverlay({ isLogOpen, onToggleLog }: Props) {
  const { isTimeSeriesOpen } = useEventLogState();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onClick={onToggleLog}
        aria-pressed={isLogOpen}
        title={isLogOpen ? "Close the event log" : "Open the event log"}
        className="pointer-events-auto absolute top-[60%] right-0 hidden cursor-pointer lg:flex flex-col items-center gap-2 rounded-l-xl border border-r-0 border-glass-line bg-glass px-2.5 py-4 text-accent-ink backdrop-blur hover:brightness-110"
      >
        <ListChecks className="size-4" aria-hidden />
        <span className="text-xs font-semibold tracking-[0.14em] [writing-mode:vertical-rl]">EVENT LOG</span>
      </button>
      {IS_TIME_SERIES_DRAWER_ENABLED && isLogOpen && isTimeSeriesOpen && <TimeSeriesDrawer />}
    </div>
  );
}
