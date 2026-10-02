"use client";

import { LineChart, Focus } from "lucide-react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { findSensor } from "@/features/live-data/live-data-sensors";
import { useEventLog } from "../hooks/use-event-log";
import { selectLogEvent, setTimeSeriesOpen, useEventLogState } from "../lib/event-log-store";
import { TimeSeriesDrawer } from "./time-series-drawer";

type Props = {
  /** Lets the camera follow the ship again: clears the focus. */
  onShowWholeShip: () => void;
};

const CHIP_CLASS = "pointer-events-auto flex items-center gap-3 rounded-xl border border-glass-line bg-glass px-4 py-3 text-[13px] text-ink backdrop-blur";

/**
 * Over the scene while the log is open: what the camera is on — the ship it
 * follows, or the component of the selected event, from its warning — the
 * time series tab on the right edge, and the drawer it opens.
 */
export function LogSceneOverlay({ onShowWholeShip }: Props) {
  const snapshot = useLiveData();
  const { events } = useEventLog();
  const { selectedEventId, isTimeSeriesOpen } = useEventLogState();
  const selected = events.find((event) => event.id === selectedEventId);
  const sensor = selected?.sensorId ? findSensor(selected.sensorId) : undefined;
  const isFocused = selected?.componentLabel != null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute top-4 left-4">
        {isFocused && selected ? (
          <p className={CHIP_CLASS}>
            <Focus className="size-4 shrink-0 text-accent-ink" aria-hidden />
            <span>
              <strong>Focused on {[selected.componentLabel, selected.sensorId].filter(Boolean).join(" · ")}</strong>
              <span className="text-ink-2"> · from the selected {selected.kind === "info" ? "event" : "warning"}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                selectLogEvent(null);
                onShowWholeShip();
              }}
              className="cursor-pointer rounded-lg bg-btn px-3 py-1.5 font-semibold hover:brightness-110"
            >
              Show whole ship
            </button>
          </p>
        ) : (
          <p className={CHIP_CLASS}>
            <span className="size-2 rounded-full bg-ok" aria-hidden />
            <strong>Following ship</strong>
            {snapshot && (
              <span className="font-mono text-ink-2">
                {snapshot.navigation.speedOverGroundKn.toFixed(1)} kn · {String(Math.round(snapshot.navigation.headingDeg)).padStart(3, "0")}°
              </span>
            )}
          </p>
        )}
        {sensor && isFocused && <span className="sr-only">{sensor.name}</span>}
      </div>

      {!isTimeSeriesOpen && (
        <button
          type="button"
          onClick={() => setTimeSeriesOpen(true)}
          className="pointer-events-auto absolute top-1/3 right-0 flex cursor-pointer flex-col items-center gap-2 rounded-l-xl border border-r-0 border-glass-line bg-glass px-2.5 py-4 text-accent-ink backdrop-blur hover:brightness-110"
        >
          <LineChart className="size-4" aria-hidden />
          <span className="text-xs font-semibold tracking-[0.14em] [writing-mode:vertical-rl]">TIME SERIES</span>
        </button>
      )}
      {isTimeSeriesOpen && <TimeSeriesDrawer />}
    </div>
  );
}
