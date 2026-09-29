"use client";

import { useMemo, useState } from "react";
import { Download, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { PLAYBACK_WINDOW_MINUTES } from "@/features/live-data/live-data-config";
import { getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";
import { EVENT_TABS } from "../event-log-config";
import type { LogEvent } from "../event-log-types";
import { useEventLog } from "../hooks/use-event-log";
import { downloadText, toCsv } from "../lib/export-csv";
import { readingColumnsFor } from "../lib/reading-columns";
import { EventDetail } from "./event-detail";
import { EventLogTable } from "./event-log-table";
import { ReadingsTable } from "./readings-table";

type Props = {
  /** The system the log is filtered to, by its section id; null for all. */
  systemId: string | null;
  onSystemChange: (systemId: string | null) => void;
  onShowOnShip: (componentLabel: string) => void;
  onAsk: (question: string) => void;
};

type Tab = (typeof EVENT_TABS)[number]["id"];

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const CONTROL_CLASS = "flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line px-3.5 text-[13px] font-semibold hover:border-accent-line";

/** Whether an event belongs to a system: its component is in that section of the tree. */
function isInSystem(event: LogEvent, systemId: string | null) {
  if (!systemId) return true;
  return event.componentLabel !== null && getSectionIdOf({ id: event.componentLabel, label: event.componentLabel }) === systemId;
}

/**
 * The event log over the scene: everything the ship's data and its operator
 * did in the kept window, filtered and searched, an event in full beside it —
 * or the readings themselves, the time series, to see or export.
 */
export function EventLogView({ systemId, onSystemChange, onShowOnShip, onAsk }: Props) {
  const { events: liveEvents, history, actions } = useEventLog();
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [frozen, setFrozen] = useState<LogEvent[]>([]);
  const [mode, setMode] = useState<"events" | "readings">("events");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = isFollowingLive ? liveEvents : frozen;
  const inSystem = useMemo(() => events.filter((event) => isInSystem(event, systemId)), [events, systemId]);
  const query = search.trim().toLowerCase();
  const kinds = EVENT_TABS.find((candidate) => candidate.id === tab)?.kinds ?? [];
  const shown = inSystem.filter(
    (event) =>
      kinds.includes(event.kind) &&
      (!query || `${event.title} ${event.componentLabel ?? ""} ${event.subject ?? ""} ${event.status}`.toLowerCase().includes(query))
  );
  const selected = events.find((event) => event.id === selectedId) ?? shown.find((event) => event.isAttention) ?? shown[0] ?? null;
  const columns = readingColumnsFor(systemId);
  const latest = history[history.length - 1];

  const toggleFollowLive = () => {
    if (isFollowingLive) setFrozen(liveEvents);
    setIsFollowingLive(!isFollowingLive);
  };

  const exportCsv = () => {
    if (mode === "events") {
      const text = toCsv(
        ["number", "time_utc", "severity", "component", "subject", "event", "value", "status"],
        shown.map((event) => [event.number, new Date(event.at).toISOString(), event.kind, event.componentLabel, event.subject, event.title, event.value, event.status])
      );
      downloadText("twinship-event-log.csv", text);
      return;
    }
    const text = toCsv(
      ["time_utc", ...columns.map((column) => `${column.label} (${column.unit})`)],
      history.map((snapshot) => [new Date(snapshot.timestamp).toISOString(), ...columns.map((column) => column.value(snapshot)?.toFixed(column.digits))])
    );
    downloadText("twinship-readings.csv", text);
  };

  return (
    <div className="absolute inset-0 z-30 flex bg-surface text-ink">
      <section className="flex min-w-0 grow flex-col">
        <header className="flex shrink-0 items-start gap-3 px-5 pt-5 pb-3">
          <div className="mr-auto flex min-w-0 flex-col">
            <h1 className="text-2xl font-bold">{mode === "events" ? "Event log" : "Readings"}</h1>
            <p className="text-[13px] text-ink-2">
              {latest ? `Today · ${DATE_FORMAT.format(latest.timestamp)} · ` : ""}
              {mode === "events"
                ? `${shown.length} of ${events.length} events · newest first`
                : `${history.length} s of readings · a row every 5 s · newest first`}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleFollowLive}
            aria-pressed={isFollowingLive}
            className={cn(CONTROL_CLASS, isFollowingLive && "border-ok bg-ok-soft text-ok")}
          >
            <span className={cn("size-2 rounded-full", isFollowingLive ? "bg-ok" : "bg-muted")} aria-hidden />
            {isFollowingLive ? "Follow live" : `Paused · ${latest ? formatUtcTime(latest.timestamp) : ""}`}
          </button>
          <button type="button" onClick={exportCsv} className={CONTROL_CLASS}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 pb-3">
          <div role="tablist" aria-label="Show" className="flex gap-1 rounded-lg border border-line p-1">
            {(["events", "readings"] as const).map((option) => (
              <button
                key={option}
                role="tab"
                type="button"
                aria-selected={mode === option}
                onClick={() => setMode(option)}
                className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold capitalize", mode === option ? "bg-btn text-ink" : "text-ink-2")}
              >
                {option}
              </button>
            ))}
          </div>
          {mode === "events" && (
            <div role="tablist" aria-label="Severity" className="flex gap-1 rounded-lg border border-line p-1">
              {EVENT_TABS.map((option) => (
                <button
                  key={option.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === option.id}
                  onClick={() => setTab(option.id)}
                  className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold", tab === option.id ? "bg-btn text-ink" : "text-ink-2")}
                >
                  {option.label} <span className="font-normal text-muted">{inSystem.filter((event) => option.kinds.includes(event.kind)).length}</span>
                </button>
              ))}
            </div>
          )}
          <select
            value={systemId ?? ""}
            onChange={(event) => onSystemChange(event.target.value || null)}
            aria-label="System"
            className={cn(CONTROL_CLASS, "bg-surface")}
          >
            <option value="">All systems</option>
            {SHIP_TREE_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>{section.label}</option>
            ))}
          </select>
          <span className={cn(CONTROL_CLASS, "cursor-default hover:border-line")}>Last {PLAYBACK_WINDOW_MINUTES} min</span>
          {mode === "events" && (
            <label className="ml-auto flex h-10 w-60 items-center gap-2 rounded-lg border border-line bg-card px-3 focus-within:border-accent-line">
              <SearchIcon className="size-4 shrink-0 text-muted" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events…"
                className="min-w-0 grow bg-transparent text-[13px] outline-none placeholder:text-muted"
              />
            </label>
          )}
        </div>

        {mode === "events" ? (
          <EventLogTable events={shown} selectedId={selected?.id ?? null} onSelect={(event) => setSelectedId(event.id)} />
        ) : (
          <ReadingsTable history={history} columns={columns} />
        )}
      </section>
      {mode === "events" && selected && (
        <EventDetail
          event={selected}
          events={events}
          history={history}
          actions={actions}
          onSelect={(event) => setSelectedId(event.id)}
          onShowOnShip={onShowOnShip}
          onAsk={onAsk}
        />
      )}
    </div>
  );
}
