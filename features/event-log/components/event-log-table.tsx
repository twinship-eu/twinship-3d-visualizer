"use client";

import { cn } from "@/lib/utils";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { EVENT_KIND_CHIPS } from "../event-log-config";
import type { LogEvent } from "../event-log-types";

type Props = {
  events: LogEvent[];
  selectedId: string | null;
  onSelect: (event: LogEvent) => void;
};

const COLUMNS = "grid grid-cols-[76px_88px_minmax(110px,1fr)_minmax(140px,2fr)_72px_minmax(96px,1fr)] gap-3";

/** An event's severity, as the design's chip. */
export function EventKindChip({ kind }: { kind: LogEvent["kind"] }) {
  const chip = EVENT_KIND_CHIPS[kind];
  return <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", chip.className)}>{chip.label}</span>;
}

/** Where an event is on the ship: its component's dot and label, and what on it. */
export function EventComponent({ event }: { event: LogEvent }) {
  const label = event.componentLabel ?? "Data stream";
  const dotClass = event.componentLabel ? getSectionDotClass(getSectionIdOf({ id: label, label })) : "bg-muted";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn("size-[7px] shrink-0 rounded-full", dotClass)} aria-hidden />
      <span className="truncate">
        {label}
        {event.subject && event.componentLabel && <span className="text-ink-2"> · {event.subject}</span>}
      </span>
    </span>
  );
}

/** The log's rows, newest first: each selects its event for the detail beside. */
export function EventLogTable({ events, selectedId, onSelect }: Props) {
  return (
    <div role="table" aria-label="Event log" className="flex min-h-0 flex-col text-[13px]">
      <div role="row" className={cn(COLUMNS, "shrink-0 border-b border-line px-5 py-3 text-[11px] font-semibold tracking-[0.1em] text-muted")}>
        <span role="columnheader">TIME UTC</span>
        <span role="columnheader">SEVERITY</span>
        <span role="columnheader">COMPONENT</span>
        <span role="columnheader">EVENT</span>
        <span role="columnheader">VALUE</span>
        <span role="columnheader">STATUS</span>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {events.length === 0 && <p className="px-5 py-6 text-muted">No events match.</p>}
        {events.map((event) => (
          <button
            key={event.id}
            role="row"
            type="button"
            onClick={() => onSelect(event)}
            aria-selected={event.id === selectedId}
            className={cn(
              COLUMNS,
              "w-full cursor-pointer items-center border-b border-line border-l-2 border-l-transparent px-5 py-3.5 text-left hover:bg-card",
              event.id === selectedId && "border-l-accent bg-accent-soft/40"
            )}
          >
            <span role="cell" className="font-mono">{formatUtcTime(event.at)}</span>
            <span role="cell"><EventKindChip kind={event.kind} /></span>
            <span role="cell" className="min-w-0"><EventComponent event={event} /></span>
            <span role="cell" className="truncate">{event.title}</span>
            <span role="cell" className="truncate font-mono">{event.value ?? "—"}</span>
            <span role="cell" className={cn("truncate text-ink-2", event.isAttention && "font-semibold text-warn")}>{event.status}</span>
          </button>
        ))}
        <p className="px-5 py-4 text-xs text-muted">
          The log reads the timeline&apos;s window of kept data: earlier events are not kept in the viewer.
        </p>
      </div>
    </div>
  );
}
