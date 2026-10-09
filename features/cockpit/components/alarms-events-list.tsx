"use client";

import { Activity, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAlarms, getActiveAnomalies, isBehaviourAnomaly, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import type { Alarm, AlarmSeverity } from "@/features/live-data/live-data-types";

type Props = {
  /** Opens an alarm's component. */
  onOpen: (alarm: Alarm) => void;
  /** Opens the event log, from the header's "Full log". */
  onOpenLog?: () => void;
  /** Its height, when it shares the panel's foot with more: the list scrolls within it. */
  maxHeightClass?: string;
};

const SEVERITY_ICONS: Record<AlarmSeverity, typeof Info> = {
  alarm: TriangleAlert,
  warning: TriangleAlert,
  info: Info,
  resolved: CircleCheck,
};

const SEVERITY_ICON_CLASSES: Record<AlarmSeverity, string> = {
  alarm: "text-warn",
  warning: "text-warn",
  info: "text-accent",
  resolved: "text-ok",
};

/**
 * Under the tree, in Live data: the alarms and the ship's logged events,
 * the active ones first and highlighted. Each opens its component.
 */
export function AlarmsEventsList({ onOpen, onOpenLog, maxHeightClass = "max-h-[45vh]" }: Props) {
  const snapshot = useLiveData();
  const alarms = snapshot?.alarms ?? [];
  // A limit warning amber, a behaviour anomaly (a group's, the ship's) orange-red
  const active = new Set([...getActiveAlarms(snapshot), ...getActiveAnomalies(snapshot)].map((alarm) => alarm.id));
  // Active first, then the rest, newest first within each
  const ordered = [...alarms].sort(
    (a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || b.raisedAt - a.raisedAt
  );

  return (
    <section aria-label="Alarms and events" className={cn("flex min-h-0 flex-col border-t border-line", maxHeightClass)}>
      <div className="flex shrink-0 items-center justify-between px-3.5 pt-3.5 pb-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted">ALARMS &amp; EVENTS</h2>
        {onOpenLog && (
          <button type="button" onClick={onOpenLog} className="mr-auto ml-3 cursor-pointer text-xs font-semibold text-accent-ink hover:text-accent">
            Full log →
          </button>
        )}
        {active.size > 0 && (
          <span className="rounded-full bg-alarm-badge px-2 py-px text-[11px] font-bold text-alarm-badge-ink">
            {active.size} active
          </span>
        )}
      </div>
      <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto px-3.5 pb-3.5">
        {ordered.map((alarm) => {
          const isAnomaly = isBehaviourAnomaly(alarm);
          const Icon = isAnomaly ? Activity : SEVERITY_ICONS[alarm.severity];
          const isActive = active.has(alarm.id);
          return (
            <li key={alarm.id}>
              <button
                type="button"
                onClick={() => onOpen(alarm)}
                className={cn(
                  "flex w-full cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  isActive
                    ? isAnomaly
                      ? "border-anomaly-line bg-anomaly-soft"
                      : "border-warn-line bg-warn-soft"
                    : "border-line bg-card hover:border-line-strong"
                )}
              >
                <Icon className={cn("mt-px size-4 shrink-0", isAnomaly ? "text-anomaly" : SEVERITY_ICON_CLASSES[alarm.severity])} aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5 text-xs leading-[1.35]">
                  <span className={cn("font-semibold", isActive ? (isAnomaly ? "text-anomaly-ink" : "text-warn-ink") : "text-ink")}>{alarm.title}</span>
                  <span className="text-ink-2">{alarm.detail}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {formatUtcTime(alarm.raisedAt)}
                    {alarm.severity === "warning" && (isActive ? isAnomaly && " · unacknowledged" : " · acknowledged")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
