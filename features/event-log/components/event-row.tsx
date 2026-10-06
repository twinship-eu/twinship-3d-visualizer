"use client";

import { LineChart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { acknowledgeAlarm } from "@/features/live-data/hooks/use-live-data";
import { findSensor } from "@/features/live-data/live-data-sensors";
import type { LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import { partRelationsOf } from "@/features/ship-visualizer/lib/knowledge-graph";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";
import { IS_TIME_SERIES_DRAWER_ENABLED } from "../event-log-config";
import type { LogEvent } from "../event-log-types";
import { lifecycleOf } from "../lib/build-event-log";
import { EventKindChip } from "./event-kind-chip";

type Props = {
  event: LogEvent;
  isSelected: boolean;
  history: LiveSnapshot[];
  actions: OperatorAction[];
  onSelect: () => void;
  onFocus: (componentLabel: string) => void;
  onAsk: (question: string) => void;
  onShowTimeSeries: () => void;
};

const SECTION_LABEL_CLASS = "text-xs text-muted";
const SECONDARY_BUTTON_CLASS =
  "flex h-11 min-w-0 grow cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:border-accent-line";

/** An event's severity as its row's dot: alarm red, warning amber, the rest blue, cleared green. */
const DOT_CLASS: Record<LogEvent["kind"], string> = {
  alarm: "bg-alarm",
  warning: "bg-warn",
  info: "bg-accent",
  operator: "bg-system-propeller",
  cleared: "bg-ok",
  system: "bg-muted",
};

/** The components an event touches, for its chips: its own, the alarm's related sensors', and the graph's neighbours. */
function relatedLabelsOf(event: LogEvent, relatedSensorIds: string[]) {
  if (!event.componentLabel) return [];
  const sensors = relatedSensorIds.flatMap((id) => {
    const sensor = findSensor(id);
    return sensor ? [{ label: sensor.componentLabel, name: sensor.id }] : [];
  });
  const parts = partRelationsOf(event.componentLabel).flatMap((relation) =>
    relation.partLabel ? [{ label: relation.partLabel, name: relation.partLabel }] : []
  );
  const all = [{ label: event.componentLabel, name: event.componentLabel }, ...sensors, ...parts];
  return all.filter((item, index) => all.findIndex((other) => other.name === item.name) === index);
}

/**
 * One event of the log in its panel: time, title and value over its kind,
 * component and status. Selected, it opens in place — where it is on the
 * ship, its limit, source and number, the alarm's life along a line, the
 * components it relates to — with the way to acknowledge it, to its time
 * series, and to ask the assistant about it.
 */
export function EventRow({ event, isSelected, history, actions, onSelect, onFocus, onAsk, onShowTimeSeries }: Props) {
  const latest = history[history.length - 1];
  const alarm = latest?.alarms.find((candidate) => candidate.id === event.alarmId);
  const sensor = event.sensorId ? findSensor(event.sensorId) : undefined;
  const section = event.componentLabel
    ? SHIP_TREE_SECTIONS.find((candidate) => candidate.id === getSectionIdOf({ id: event.componentLabel ?? "", label: event.componentLabel ?? "" }))
    : undefined;
  const lifecycle = isSelected && alarm && event.kind !== "operator" ? lifecycleOf(alarm, history, actions) : null;
  const canAcknowledge = alarm !== undefined && alarm.severity !== "resolved" && !alarm.isAcknowledged;
  const place = [event.componentLabel ?? "Data stream", event.subject].filter(Boolean).join(" · ");
  const lifecycleDone = lifecycle ? lifecycle.filter((step) => step.at).length : 0;

  return (
    <li className={cn("border-b border-line border-l-2", isSelected ? "border-l-accent bg-accent-soft/30" : "border-l-transparent")}>
      <button type="button" onClick={onSelect} aria-expanded={isSelected} className="flex w-full cursor-pointer flex-col gap-1.5 px-5 py-3.5 text-left hover:bg-card">
        <span className="flex items-baseline gap-3">
          <span className={cn("mt-1.5 size-[7px] shrink-0 self-start rounded-full", DOT_CLASS[event.kind])} aria-hidden />
          <span className="font-mono text-[13px] text-ink-2">{formatUtcTime(event.at)}</span>
          <span className="min-w-0 grow font-semibold">{event.title}</span>
          <span className="shrink-0 font-mono text-[13px]">{event.value ?? ""}</span>
        </span>
        <span className="flex items-center gap-2 pl-[22px] text-[13px]">
          <EventKindChip kind={event.kind} />
          <span className="min-w-0 grow truncate text-ink-2">{place}</span>
          <span className={cn("shrink-0 text-ink-2", event.isAttention && "font-semibold text-warn")}>{event.status}</span>
        </span>
      </button>

      {isSelected && (
        <div className="flex flex-col gap-4 px-5 pt-1 pb-5 pl-[42px] text-[13px]">
          {event.componentLabel && (
            <p className="text-ink-2">{[section?.label, event.componentLabel, sensor?.name].filter(Boolean).join(" › ")}</p>
          )}
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: "Limit", value: sensor?.warnAt !== undefined ? `${sensor.warnAt}${sensor.unit === "%" ? "%" : ` ${sensor.unit}`}` : "—" },
              { label: "Source", value: event.sensorId ?? event.subject ?? "—" },
              { label: "Event", value: `#${event.number}` },
            ].map((fact) => (
              <div key={fact.label}>
                <dt className={SECTION_LABEL_CLASS}>{fact.label}</dt>
                <dd className="font-mono text-base font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {event.readings && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5" aria-label="The row's readings">
              {event.readings.map((reading) => (
                <div key={reading.id} className="flex justify-between gap-2 border-b border-line/60 py-1">
                  <dt className="truncate text-ink-2">{reading.label}</dt>
                  <dd className={cn("shrink-0 font-mono", reading.state === "alarm" ? "text-alarm" : reading.state === "warning" ? "font-semibold text-warn" : "")}>
                    {reading.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {lifecycle && (
            <ol className="relative grid grid-cols-4 gap-2" aria-label="Life of the alarm">
              <span className="absolute top-[5px] right-[12%] left-[6px] h-0.5 bg-line-strong" aria-hidden />
              <span
                className="absolute top-[5px] left-[6px] h-0.5 bg-accent"
                style={{ width: `${Math.max(0, lifecycleDone - 1) * 29}%` }}
                aria-hidden
              />
              {lifecycle.map((step) => (
                <li key={step.label} className="relative flex flex-col gap-0.5">
                  <span className={cn("size-3 rounded-full border-2", step.at ? "border-accent bg-accent" : "border-line-strong bg-surface")} aria-hidden />
                  <span className={cn("mt-1 font-semibold", !step.at && "text-muted")}>
                    {step.label === "Peak" && step.value ? `Peak ${step.value}` : step.label}
                  </span>
                  <span className="font-mono text-xs text-muted">{step.at ? formatUtcTime(step.at) : "—"}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap gap-2">
            {relatedLabelsOf(event, alarm?.relatedSensorIds ?? []).map((component) => (
              <button
                key={component.name}
                type="button"
                onClick={() => onFocus(component.label)}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 hover:border-accent-line"
              >
                <span className={cn("size-[7px] rounded-full", getSectionDotClass(getSectionIdOf({ id: component.label, label: component.label })))} aria-hidden />
                {component.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {canAcknowledge && alarm && (
              <button
                type="button"
                onClick={() => acknowledgeAlarm(alarm.id)}
                className="flex h-11 min-w-0 grow-[1.4] cursor-pointer items-center justify-center rounded-lg bg-warn px-3 text-sm font-semibold text-black hover:brightness-110"
              >
                Acknowledge
              </button>
            )}
            {IS_TIME_SERIES_DRAWER_ENABLED && event.sensorId && (
              <button type="button" onClick={onShowTimeSeries} className={SECONDARY_BUTTON_CLASS}>
                <LineChart className="size-4 shrink-0" aria-hidden />
                Time series
              </button>
            )}
            <button
              type="button"
              onClick={() => onAsk(`Tell me about event #${event.number}: ${event.title}${event.componentLabel ? ` on ${event.componentLabel}` : ""}.`)}
              className={SECONDARY_BUTTON_CLASS}
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden />
              Ask about this
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
