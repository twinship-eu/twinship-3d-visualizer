"use client";

import { Crosshair, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { findSensor } from "@/features/live-data/live-data-sensors";
import type { Alarm, LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import { TrendChart } from "@/features/cockpit/component-live/trend-chart";
import { partRelationsOf } from "@/features/ship-visualizer/lib/knowledge-graph";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";
import { RELATED_EVENTS_WINDOW_MS, TREND_LEAD_MINUTES } from "../event-log-config";
import type { LogEvent } from "../event-log-types";
import { lifecycleOf } from "../lib/build-event-log";
import { EventKindChip } from "./event-log-table";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

type Props = {
  event: LogEvent;
  events: LogEvent[];
  history: LiveSnapshot[];
  actions: OperatorAction[];
  onSelect: (event: LogEvent) => void;
  onShowOnShip: (componentLabel: string) => void;
  onAsk: (question: string) => void;
};

/** The components an event touches: its own, its alarm's related sensors', and the knowledge graph's 3D parts beside it. */
function relatedComponentsOf(event: LogEvent, alarm: Alarm | undefined) {
  if (!event.componentLabel) return [];
  // The component, then its related sensors by id (their component's colour), then its 3D neighbours in the graph
  const sensors = (alarm?.relatedSensorIds ?? []).flatMap((id) => {
    const sensor = findSensor(id);
    return sensor ? [{ label: sensor.componentLabel, name: sensor.id }] : [];
  });
  const parts = partRelationsOf(event.componentLabel).flatMap((relation) =>
    relation.partLabel ? [{ label: relation.partLabel, name: relation.partLabel }] : []
  );
  return [{ label: event.componentLabel, name: event.componentLabel }, ...sensors, ...parts];
}

/** The sensor's trend from a little before the event to now, with its limits and the event marked. */
function EventTrend({ event, history }: { event: LogEvent; history: LiveSnapshot[] }) {
  const sensor = event.sensorId ? findSensor(event.sensorId) : undefined;
  if (!sensor) return null;
  const from = event.at - TREND_LEAD_MINUTES * 60_000;
  const shown = history.filter((snapshot) => snapshot.timestamp >= from && snapshot.sensors[sensor.id] !== undefined);
  if (shown.length < 2) return null;
  const start = shown[0].timestamp;
  const span = shown[shown.length - 1].timestamp - start || 1;
  const markerShare = Math.min(1, Math.max(0, (event.at - start) / span));

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-ink-2">
          {sensor.id} {sensor.quantity.toLowerCase()} · {formatUtcTime(start).slice(0, 5)}–now
        </span>
        {sensor.warnAt !== undefined && <span className="text-warn">limit {sensor.warnAt}{sensor.unit}</span>}
      </div>
      <div className="relative h-28">
        <TrendChart
          lines={[{ values: shown.map((snapshot) => snapshot.sensors[sensor.id] ?? 0), strokeClass: "stroke-warn" }]}
          limits={[
            ...(sensor.warnAt !== undefined ? [{ value: sensor.warnAt, tone: "warn" as const }] : []),
            ...(sensor.alarmAt !== undefined ? [{ value: sensor.alarmAt, tone: "alarm" as const }] : []),
          ]}
          className="absolute inset-0 size-full"
        />
        {/* The event's moment on the trend */}
        <span className="absolute inset-y-0 w-px bg-ink-2" style={{ left: `${markerShare * 100}%` }} aria-hidden />
        <span className="absolute top-0 ml-1 font-mono text-[11px] text-ink-2" style={{ left: `${markerShare * 100}%` }}>
          {formatUtcTime(event.at)}
        </span>
      </div>
    </section>
  );
}

/**
 * An event in full, beside the log: what and where, its value against its
 * limit, its alarm's life, the reading's trend, and what it relates to —
 * with the way to it on the ship, and to ask the assistant about it.
 */
export function EventDetail({ event, events, history, actions, onSelect, onShowOnShip, onAsk }: Props) {
  const latest = history[history.length - 1];
  const alarm = latest?.alarms.find((candidate) => candidate.id === event.alarmId);
  const sensor = event.sensorId ? findSensor(event.sensorId) : undefined;
  const section = event.componentLabel
    ? SHIP_TREE_SECTIONS.find((candidate) => candidate.id === getSectionIdOf({ id: event.componentLabel ?? "", label: event.componentLabel ?? "" }))
    : undefined;
  const lifecycle = alarm && event.kind !== "operator" ? lifecycleOf(alarm, history, actions) : null;
  const related = relatedComponentsOf(event, alarm);
  const relatedEvents = events.filter(
    (other) =>
      other.id !== event.id &&
      other.componentLabel === event.componentLabel &&
      Math.abs(other.at - event.at) <= RELATED_EVENTS_WINDOW_MS
  );
  const facts = [
    { label: "Value", value: event.value ?? "—" },
    { label: "Limit", value: sensor?.warnAt !== undefined ? `${sensor.warnAt}${sensor.unit === "%" ? "%" : ` ${sensor.unit}`}` : "—" },
    { label: "Status", value: event.status },
    { label: "Source", value: event.sensorId ?? event.subject ?? "—" },
  ];

  return (
    <aside aria-label="Event" className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-6 py-5 text-sm">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <EventKindChip kind={event.kind} />
            <span className="font-mono text-ink-2">{formatUtcTime(event.at)} UTC</span>
            <span className="ml-auto font-mono text-muted">#{event.number}</span>
          </div>
          <h2 className="text-lg font-bold">{event.title}</h2>
          <p className="text-xs text-ink-2">
            {[section?.label, event.componentLabel ?? "Data stream", sensor?.name].filter(Boolean).join(" › ")}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs text-muted">{fact.label}</dt>
              <dd className={cn("font-mono font-semibold", fact.label === "Status" && event.isAttention && "text-warn")}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {lifecycle && (
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL_CLASS}>LIFECYCLE</h3>
            <ol className="flex flex-col gap-2.5">
              {lifecycle.map((step) => (
                <li key={step.label} className="flex gap-3">
                  <span className={cn("mt-1 size-3 shrink-0 rounded-full border-2", step.at ? "border-accent bg-accent" : "border-line-strong")} aria-hidden />
                  <span className="flex flex-col">
                    <span className={cn("font-semibold", !step.at && !step.value && "text-muted")}>
                      {step.label}
                      {step.value && step.at && ` · ${step.value}`}
                    </span>
                    <span className="font-mono text-xs text-muted">{step.at ? formatUtcTime(step.at) : (step.value ?? "—")}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <EventTrend event={event} history={history} />

        {related.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL_CLASS}>RELATED COMPONENTS</h3>
            <div className="flex flex-wrap gap-2">
              {related.map((component) => (
                <button
                  key={component.name}
                  type="button"
                  onClick={() => onShowOnShip(component.label)}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-accent-line"
                >
                  <span className={cn("size-[7px] rounded-full", getSectionDotClass(getSectionIdOf({ id: component.label, label: component.label })))} aria-hidden />
                  {component.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {relatedEvents.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL_CLASS}>RELATED EVENTS</h3>
            {relatedEvents.slice(0, 5).map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => onSelect(other)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3.5 py-2.5 text-left hover:border-accent-line"
              >
                <span className="font-mono text-xs text-muted">{formatUtcTime(other.at)}</span>
                <span className="min-w-0 grow truncate text-[13px]">{other.title}</span>
                <EventKindChip kind={other.kind} />
              </button>
            ))}
          </section>
        )}
      </div>
      <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-line p-4">
        <button
          type="button"
          disabled={!event.componentLabel}
          onClick={() => event.componentLabel && onShowOnShip(event.componentLabel)}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:brightness-110 disabled:cursor-default disabled:opacity-50"
        >
          <Crosshair className="size-4" aria-hidden />
          Show on ship
        </button>
        <button
          type="button"
          onClick={() => onAsk(`Tell me about event #${event.number}: ${event.title}${event.componentLabel ? ` on ${event.componentLabel}` : ""}.`)}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-semibold hover:border-accent-line"
        >
          <MessageCircle className="size-4" aria-hidden />
          Ask about this
        </button>
      </footer>
    </aside>
  );
}
