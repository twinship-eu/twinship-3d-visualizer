"use client";

import { useState } from "react";
import { BellOff, BookOpen, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { acknowledgeAlarm } from "@/features/live-data/hooks/use-live-data";
import { formatElapsed, formatUtcTime } from "@/features/live-data/lib/format-readings";
import { findSensor, sensorState } from "@/features/live-data/live-data-sensors";
import type { Alarm, LiveSnapshot } from "@/features/live-data/live-data-types";
import { ALARM_RELATED_READINGS } from "./component-live-config";
import { TrendChart } from "./trend-chart";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";
/** How long Silence keeps the alarm quiet. */
const SILENCE_MS = 5 * 60_000;

type Props = {
  alarm: Alarm;
  snapshot: LiveSnapshot;
  history: LiveSnapshot[];
  /** On a phone: acknowledge and a mute button only, without the procedure. */
  isCompact?: boolean;
};

/**
 * The panel with an alarm in focus: what it is and how it stands now, its
 * likely cause, what the ship proposes, what to watch with it — and the
 * operator's answers: acknowledge, silence, the procedure.
 */
export function AlarmFocus({ alarm, snapshot, history, isCompact = false }: Props) {
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [silencedUntil, setSilencedUntil] = useState<number | null>(null);
  const sensor = alarm.sensorId ? findSensor(alarm.sensorId) : undefined;
  const reading = sensor ? snapshot.sensors[sensor.id] : undefined;
  const isSilenced = silencedUntil !== null && silencedUntil > snapshot.timestamp;

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-6 py-5 text-sm">
        <section className="flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft p-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-warn-ink">
            <TriangleAlert className="size-5 shrink-0 text-warn" aria-hidden />
            {alarm.title}
          </h3>
          <p className="text-xs text-ink-2">
            Raised {formatUtcTime(alarm.raisedAt)} · active {formatElapsed(alarm.raisedAt, snapshot.timestamp)}
            {sensor && ` · sensor ${sensor.shortName}`}
          </p>
          {sensor && reading !== undefined && (
            <>
              <div className="flex items-end gap-4">
                <span className="flex flex-col">
                  <span className="text-[10px] tracking-[0.1em] text-muted">NOW</span>
                  <span className="font-mono text-[34px] leading-none font-semibold text-warn">
                    {reading.toFixed(0)}
                    {sensor.unit}
                  </span>
                </span>
                <span className="flex flex-col text-xs text-ink-2">
                  {sensor.warnAt !== undefined && <span>Warning ≥ {sensor.warnAt}{sensor.unit}</span>}
                  {sensor.alarmAt !== undefined && <span>Alarm ≥ {sensor.alarmAt}{sensor.unit}</span>}
                </span>
              </div>
              <TrendChart
                lines={[{ values: history.map((entry) => entry.sensors[sensor.id] ?? 0), strokeClass: "stroke-warn" }]}
                limits={[
                  ...(sensor.warnAt !== undefined ? [{ value: sensor.warnAt, tone: "warn" as const }] : []),
                  ...(sensor.alarmAt !== undefined ? [{ value: sensor.alarmAt, tone: "alarm" as const }] : []),
                ]}
                className="h-24 w-full"
              />
            </>
          )}
          {alarm.likelyCause && (
            <p className="text-xs text-ink-2">
              <b className="font-semibold text-ink">Likely cause:</b> {alarm.likelyCause}
            </p>
          )}
        </section>

        {alarm.recommendedActions && alarm.recommendedActions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL_CLASS}>RECOMMENDED ACTIONS</h3>
            {alarm.recommendedActions.map((action) => {
              const isProposed = proposed.has(action.title);
              return (
                <div key={action.title} className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3">
                  <span className="flex min-w-0 grow flex-col">
                    <span className="font-semibold">{action.title}</span>
                    <span className="text-xs text-muted">{action.prediction}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setProposed((current) => new Set(current).add(action.title))}
                    disabled={isProposed}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-[13px] font-semibold",
                      isProposed ? "border-ok text-ok" : "cursor-pointer border-line-strong hover:border-accent-line"
                    )}
                  >
                    {isProposed ? "Proposed" : "Propose"}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {(alarm.relatedSensorIds?.length || ALARM_RELATED_READINGS[alarm.id]) && (
          <section className="flex flex-col">
            <h3 className={cn(SECTION_LABEL_CLASS, "mb-1")}>RELATED SENSORS</h3>
            {(alarm.relatedSensorIds ?? []).map((sensorId) => {
              const related = findSensor(sensorId);
              const value = snapshot.sensors[sensorId];
              if (!related || value === undefined) return null;
              const isRaised = sensorState(related, value) !== "normal";
              return (
                <div key={sensorId} className="flex justify-between gap-3 border-b border-line py-3">
                  <span>{related.shortName}</span>
                  <span className={cn("font-mono font-semibold", isRaised && "text-warn")}>
                    {value.toFixed(0)}
                    {related.unit}
                  </span>
                </div>
              );
            })}
            {(ALARM_RELATED_READINGS[alarm.id] ?? []).map((related) => (
              <div key={related.label} className="flex justify-between gap-3 border-b border-line py-3 last:border-0">
                <span>{related.label}</span>
                <span className="font-mono font-semibold">{related.value(snapshot)}</span>
              </div>
            ))}
          </section>
        )}
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-line p-4">
        <button
          type="button"
          onClick={() => acknowledgeAlarm(alarm.id)}
          className="h-11 grow cursor-pointer rounded-lg bg-alarm-badge text-sm font-bold text-alarm-badge-ink hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Acknowledge
        </button>
        <button
          type="button"
          onClick={() => setSilencedUntil(snapshot.timestamp + SILENCE_MS)}
          disabled={isSilenced}
          aria-label={isCompact ? (isSilenced ? "Silenced" : "Silence 5 min") : undefined}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3.5 text-sm font-semibold disabled:cursor-default disabled:text-muted"
        >
          <BellOff className="size-4" aria-hidden />
          {!isCompact && (isSilenced ? `Silenced to ${formatUtcTime(silencedUntil!).slice(0, 5)}` : "Silence 5 min")}
        </button>
        {!isCompact && (
        <button
          type="button"
          disabled
          title="No procedure is linked to this alarm in the ontology yet"
          className="flex h-11 cursor-not-allowed items-center gap-1.5 rounded-lg border border-line-strong px-3.5 text-sm font-semibold text-muted"
        >
          <BookOpen className="size-4" aria-hidden />
          Procedure
        </button>
        )}
      </footer>
    </div>
  );
}
