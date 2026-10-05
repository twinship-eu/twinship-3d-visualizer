"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { findSensor } from "@/features/live-data/live-data-sensors";
import { EVENT_KIND_CHIPS } from "../event-log-config";
import { seriesFor, TIME_TICKS, VALUE_TICKS } from "../event-log-series";
import type { LogEvent } from "../event-log-types";
import { useEventLog } from "../hooks/use-event-log";
import { selectLogEvent, setTimeSeriesOpen, useEventLogState } from "../lib/event-log-store";

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 40;
/** A share of the range left free above and below the line. */
const HEADROOM = 0.12;
/** Colours of the log's marks along the time axis, by kind. */
const MARK_CLASS: Record<string, string> = {
  alarm: "border-b-alarm",
  warning: "border-b-warn",
  info: "border-b-accent",
  operator: "border-b-system-propeller",
  cleared: "border-b-ok",
  system: "border-b-muted",
};

/**
 * Whether an event is about the reading the drawer shows: its own sensor, or
 * — an event of the component without a sensor of its own — that sensor's
 * component. The sea and the speed have no events of their own.
 */
function isAboutSeries(event: LogEvent, seriesId: string) {
  if (event.sensorId) return event.sensorId === seriesId;
  const sensor = findSensor(seriesId);
  return sensor !== undefined && event.componentLabel === sensor.componentLabel;
}

/**
 * Over the scene while the log is open: a reading across the kept window,
 * with its limit, the log's events as marks along the time axis and the
 * selected one as a line through it.
 */
export function TimeSeriesDrawer() {
  const { events, history } = useEventLog();
  const { selectedEventId } = useEventLogState();
  const selected = events.find((event) => event.id === selectedEventId);
  const tabs = seriesFor(selected?.sensorId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const active = tabs.find((series) => series.id === (selected?.sensorId ?? chosenId)) ?? tabs.find((series) => series.id === chosenId) ?? tabs[0];

  const points = history.flatMap((snapshot) => {
    const value = active.read(snapshot);
    return value === undefined ? [] : [{ at: snapshot.timestamp, value }];
  });
  if (points.length < 2) return null;
  const start = points[0].at;
  const end = points[points.length - 1].at;
  const span = end - start || 1;
  const values = [...points.map((point) => point.value), ...(active.limit !== undefined ? [active.limit] : [])];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const bottom = low - range * HEADROOM;
  const top = high + range * HEADROOM;
  const x = (at: number) => ((at - start) / span) * VIEW_WIDTH;
  const y = (value: number) => ((top - value) / (top - bottom)) * VIEW_HEIGHT;
  const share = (at: number) => `${Math.min(100, Math.max(0, ((at - start) / span) * 100))}%`;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.at).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <section
      aria-label="Time series"
      className="pointer-events-auto absolute right-4 bottom-4 left-4 flex flex-col gap-3 rounded-2xl border border-glass-line bg-glass px-5 py-4 text-ink backdrop-blur"
    >
      <header className="flex items-center gap-3">
        <h2 className="shrink-0 text-base font-bold whitespace-nowrap">Time series</h2>
        <span className="shrink-0 font-mono text-xs whitespace-nowrap text-ink-2">
          {formatUtcTime(start).slice(0, 5)} – now
        </span>
        <div role="tablist" aria-label="Reading" className="ml-3 flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-line p-1">
          {tabs.map((series) => (
            <button
              key={series.id}
              role="tab"
              type="button"
              aria-selected={series.id === active.id}
              onClick={() => setChosenId(series.id)}
              className={cn("shrink-0 cursor-pointer rounded-md px-3 py-1 text-[13px] font-semibold whitespace-nowrap", series.id === active.id ? "bg-btn text-ink" : "text-ink-2")}
            >
              {series.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setTimeSeriesOpen(false)} aria-label="Close the time series" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="relative ml-12 h-40">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {Array.from({ length: VALUE_TICKS }, (_, index) => (
            <line key={index} x1={0} x2={VIEW_WIDTH} y1={(VIEW_HEIGHT * index) / (VALUE_TICKS - 1)} y2={(VIEW_HEIGHT * index) / (VALUE_TICKS - 1)} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {active.limit !== undefined && (
            <line x1={0} x2={VIEW_WIDTH} y1={y(active.limit)} y2={y(active.limit)} className="stroke-warn" strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
          <path d={line} fill="none" className="stroke-warn" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {Array.from({ length: VALUE_TICKS }, (_, index) => {
          const value = top - ((top - bottom) * index) / (VALUE_TICKS - 1);
          return (
            <span key={index} className="absolute -left-12 w-10 -translate-y-1/2 text-right font-mono text-[11px] text-muted" style={{ top: `${(index / (VALUE_TICKS - 1)) * 100}%` }}>
              {value.toFixed(range < 10 ? 1 : 0)}
            </span>
          );
        })}
        {active.limit !== undefined && (
          <span className="absolute right-0 -translate-y-full font-mono text-[11px] text-warn" style={{ top: `${(y(active.limit) / VIEW_HEIGHT) * 100}%` }}>
            limit {active.limit}{active.unit === "%" ? "%" : ` ${active.unit}`}
          </span>
        )}
        {selected && selected.at >= start && (
          <span className="absolute inset-y-0 w-px bg-accent" style={{ left: share(selected.at) }} aria-hidden />
        )}
        {/* The log's events along the time axis, each a mark that selects it */}
        <div className="absolute inset-x-0 -bottom-4 h-4">
          {events
            .filter((event) => event.at >= start && event.at <= end && isAboutSeries(event, active.id))
            .map((event) => (
              <button
                key={event.id}
                type="button"
                title={`${formatUtcTime(event.at)} · ${event.title}`}
                aria-label={`${EVENT_KIND_CHIPS[event.kind].label}: ${event.title}`}
                onClick={() => selectLogEvent(event.id)}
                className={cn("absolute top-0 size-0 -translate-x-1/2 cursor-pointer border-x-[5px] border-b-[9px] border-x-transparent", MARK_CLASS[event.kind])}
                style={{ left: share(event.at) }}
              />
            ))}
        </div>
      </div>

      <div className="relative ml-12 flex h-4 justify-between font-mono text-[11px] text-muted">
        {Array.from({ length: TIME_TICKS }, (_, index) => (
          <span key={index}>{formatUtcTime(start + (span * index) / (TIME_TICKS - 1)).slice(0, 5)}</span>
        ))}
      </div>
      <footer className="flex justify-between text-xs text-ink-2">
        <span>
          <span className="mr-1 inline-block border-x-[4px] border-b-[7px] border-x-transparent border-b-warn align-middle" aria-hidden /> this reading&apos;s events on the timeline
          {selected && <span className="ml-3 border-l border-accent pl-2">selected event · {formatUtcTime(selected.at)}</span>}
        </span>
        <span>{active.label} now {last.value.toFixed(active.unit === "m" || active.unit === "kn" ? 1 : 0)}{active.unit === "%" ? "%" : ` ${active.unit}`}</span>
      </footer>
    </section>
  );
}
