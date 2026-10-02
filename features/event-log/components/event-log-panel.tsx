"use client";

import { useMemo, useState } from "react";
import { Download, SearchIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { EVENT_TABS } from "../event-log-config";
import type { LogEvent } from "../event-log-types";
import { useEventLog } from "../hooks/use-event-log";
import { downloadText, toCsv } from "../lib/export-csv";
import { selectLogEvent, setTimeSeriesOpen, useEventLogState } from "../lib/event-log-store";
import { EventRow } from "./event-row";

type Props = {
  /** The system the log is filtered to, by its section id (from the tree); null for all. */
  systemId: string | null;
  onFocus: (componentLabel: string) => void;
  onAsk: (question: string) => void;
  onClose: () => void;
};

type Tab = (typeof EVENT_TABS)[number]["id"];

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const ICON_BUTTON_CLASS =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Whether an event belongs to a system: its component is in that section of the tree. */
function isInSystem(event: LogEvent, systemId: string | null) {
  if (!systemId) return true;
  return event.componentLabel !== null && getSectionIdOf({ id: event.componentLabel, label: event.componentLabel }) === systemId;
}

/**
 * The event log beside the ship: everything the ship's data and its operator
 * did in the kept window, newest first, to filter and search; an event opens
 * in place and the ship focuses on its component while the scene goes on.
 */
export function EventLogPanel({ systemId, onFocus, onAsk, onClose }: Props) {
  const { events: liveEvents, history, actions } = useEventLog();
  const { selectedEventId } = useEventLogState();
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [frozen, setFrozen] = useState<LogEvent[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const events = isFollowingLive ? liveEvents : frozen;
  const inSystem = useMemo(() => events.filter((event) => isInSystem(event, systemId)), [events, systemId]);
  const query = search.trim().toLowerCase();
  const kinds = EVENT_TABS.find((candidate) => candidate.id === tab)?.kinds ?? [];
  const shown = inSystem.filter(
    (event) =>
      kinds.includes(event.kind) &&
      (!query || `${event.title} ${event.componentLabel ?? ""} ${event.subject ?? ""} ${event.status}`.toLowerCase().includes(query))
  );
  const latest = history[history.length - 1];

  const toggleFollowLive = () => {
    if (isFollowingLive) setFrozen(liveEvents);
    setIsFollowingLive(!isFollowingLive);
  };
  const exportCsv = () =>
    downloadText(
      "twinship-event-log.csv",
      toCsv(
        ["number", "time_utc", "severity", "component", "subject", "event", "value", "status"],
        shown.map((event) => [event.number, new Date(event.at).toISOString(), event.kind, event.componentLabel, event.subject, event.title, event.value, event.status])
      )
    );
  const select = (event: LogEvent) => {
    const isOpen = event.id === selectedEventId;
    selectLogEvent(isOpen ? null : event.id);
    // The ship focuses on the event's component; closing it, or a system event, lets the camera follow the ship again
    if (!isOpen && event.componentLabel) onFocus(event.componentLabel);
  };

  return (
    <aside aria-label="Event log" className="hidden w-[480px] shrink-0 flex-col border-l border-line bg-surface text-ink lg:flex">
      <header className="flex shrink-0 items-start gap-3 px-5 pt-5 pb-3">
        <div className="mr-auto flex min-w-0 flex-col">
          <h2 className="text-xl font-bold">Event log</h2>
          <p className="text-xs text-ink-2">
            {latest ? `Today · ${DATE_FORMAT.format(latest.timestamp)} · ` : ""}
            {shown.length} of {events.length} · newest first
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFollowLive}
          aria-pressed={isFollowingLive}
          className={cn(
            "flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-semibold",
            isFollowingLive && "border-ok bg-ok-soft text-ok"
          )}
        >
          <span className={cn("size-2 rounded-full", isFollowingLive ? "bg-ok" : "bg-muted")} aria-hidden />
          {isFollowingLive ? "Live" : "Paused"}
        </button>
        <button type="button" onClick={exportCsv} aria-label="Export the log as CSV" title="Export CSV" className={ICON_BUTTON_CLASS}>
          <Download className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            selectLogEvent(null);
            setTimeSeriesOpen(false);
            onClose();
          }}
          aria-label="Close the event log"
          className={ICON_BUTTON_CLASS}
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3">
        <div role="tablist" aria-label="Severity" className="flex gap-1 rounded-lg border border-line p-1">
          {EVENT_TABS.filter((option) => option.id !== "system" || inSystem.some((event) => event.kind === "system")).map((option) => (
            <button
              key={option.id}
              role="tab"
              type="button"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn("min-w-0 grow cursor-pointer rounded-md px-2 py-1.5 text-[13px] font-semibold", tab === option.id ? "bg-btn text-ink" : "text-ink-2")}
            >
              {option.label} <span className="font-normal text-muted">{inSystem.filter((event) => option.kinds.includes(event.kind)).length}</span>
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-3 focus-within:border-accent-line">
          <SearchIcon className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events, components, sensors…"
            className="min-w-0 grow bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <ul className="min-h-0 grow overflow-y-auto border-t border-line">
        {shown.length === 0 && <li className="px-5 py-6 text-[13px] text-muted">No events match.</li>}
        {shown.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            history={history}
            actions={actions}
            onSelect={() => select(event)}
            onFocus={onFocus}
            onAsk={onAsk}
            onShowTimeSeries={() => setTimeSeriesOpen(true)}
          />
        ))}
        <li className="px-5 py-4 text-xs text-muted">The log reads the timeline&apos;s window of kept data: earlier events are not kept in the viewer.</li>
      </ul>
    </aside>
  );
}
