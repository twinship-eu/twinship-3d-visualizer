"use client";

import { ChevronLeft, ChevronRight, Ship, TriangleAlert } from "lucide-react";
import { activeAlarmOn, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatBearing, formatElapsed, formatKnots } from "@/features/live-data/lib/format-readings";
import { findSensor } from "@/features/live-data/live-data-sensors";

type Props = {
  componentLabel: string;
  /** The section it is part of, for the breadcrumb. */
  sectionLabel?: string;
  /** Back to the whole ship. */
  onOverview: () => void;
};

/** Knots above which the ship reads as under way. */
const UNDERWAY_SPEED_KN = 0.5;

/**
 * Over the scene's top, with a component selected in Live data: the way back
 * to the overview and where in the ship this is, and the ship's way —
 * or, while the component has an active alarm, the alarm's banner.
 */
export function SelectionSceneHeader({ componentLabel, sectionLabel, onOverview }: Props) {
  const snapshot = useLiveData();
  const alarm = activeAlarmOn(snapshot, componentLabel);

  if (alarm && snapshot) {
    const sensor = alarm.sensorId ? findSensor(alarm.sensorId) : undefined;
    const reading = sensor ? snapshot.sensors[sensor.id] : undefined;
    return (
      <div className="absolute inset-x-0 top-0 z-20 hidden h-[62px] items-center gap-3 bg-alarm-badge px-4 text-alarm-badge-ink lg:flex">
        <TriangleAlert className="size-5 shrink-0" aria-hidden />
        <span className="text-sm font-bold tracking-[0.1em]">{alarm.severity === "alarm" ? "ALARM" : "WARNING"}</span>
        <span className="min-w-0 truncate text-sm">
          {componentLabel} — {alarm.title.toLowerCase()}
          {sensor && reading !== undefined && (
            <>
              {" "}
              · {sensor.quantity.toLowerCase()} <b>{reading.toFixed(0)}{sensor.unit}</b> at {sensor.shortName.split(" · ")[1]?.toLowerCase()}
            </>
          )}
        </span>
        <span className="grow" />
        <span className="shrink-0 font-mono text-sm">active {formatElapsed(alarm.raisedAt, snapshot.timestamp)}</span>
      </div>
    );
  }

  const navigation = snapshot?.navigation;
  const isUnderway = (navigation?.speedOverGroundKn ?? 0) > UNDERWAY_SPEED_KN;

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-20 hidden items-start justify-between lg:flex">
      <div className="pointer-events-auto flex items-center gap-1 rounded-[9px] border border-glass-line bg-glass p-[3px] pr-3 text-[13px] backdrop-blur">
        <button
          type="button"
          onClick={onOverview}
          className="flex h-[30px] cursor-pointer items-center gap-1 rounded-md bg-seg-on px-2.5 font-semibold text-seg-on-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Overview
        </button>
        {sectionLabel && <span className="pl-2 text-muted">{sectionLabel}</span>}
        {sectionLabel && <ChevronRight className="size-3.5 text-muted" aria-hidden />}
        <span className="font-semibold">{componentLabel}</span>
      </div>
      {navigation && (
        <div className="flex h-9 items-center gap-2 rounded-[9px] border border-glass-line bg-glass px-3.5 font-mono text-[13px] font-semibold backdrop-blur">
          <Ship className="size-4 text-accent-ink" aria-hidden />
          <span className="font-sans tracking-[0.06em]">{isUnderway ? "UNDERWAY" : "STOPPED"}</span>·{" "}
          {formatKnots(navigation.speedOverGroundKn)} · {formatBearing(navigation.headingDeg)}
        </div>
      )}
    </div>
  );
}
