"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EVENT_TABS } from "@/features/event-log/event-log-config";
import { EventRow } from "@/features/event-log/components/event-row";
import { useEventLog } from "@/features/event-log/hooks/use-event-log";
import { selectLogEvent, useEventLogState } from "@/features/event-log/lib/event-log-store";
import { usePlayback } from "@/features/live-data/hooks/use-live-data";
import { formatElapsed } from "@/features/live-data/lib/format-readings";

type Props = {
  /** Opens a behaviour anomaly, from its event. */
  onOpenAnomaly: (alarmId: string) => void;
  /** Asks the assistant about an event, on the Ask tab. */
  onAsk: (question: string) => void;
};

type Tab = (typeof EVENT_TABS)[number]["id"];

/**
 * Below lg, the Log tab under the scene: the event log — newest first, by
 * severity as chips — each event opening in place, as on the desktop's panel.
 */
export function MobileLog({ onAsk, onOpenAnomaly }: Props) {
  const { events, history, actions } = useEventLog();
  const { selectedEventId } = useEventLogState();
  const playback = usePlayback();
  const [tab, setTab] = useState<Tab>("all");
  const kinds = EVENT_TABS.find((candidate) => candidate.id === tab)?.kinds ?? [];
  const shown = events.filter((event) => kinds.includes(event.kind));
  const replayBehind = playback.viewedAt !== null && playback.latest !== null ? formatElapsed(playback.viewedAt, playback.latest) : null;

  return (
    <div className="flex flex-col pb-6 lg:hidden">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold">Event log</h2>
          <p className="text-[13px] text-muted">Today · {events.length} events · newest first</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
            replayBehind ? "border-warn-line bg-warn-soft text-warn-ink" : "border-ok bg-ok-soft text-ok"
          )}
        >
          <span className={cn("size-2 rounded-full", replayBehind ? "bg-warn" : "bg-ok")} aria-hidden />
          {replayBehind ? `Replay −${replayBehind}` : "Live"}
        </span>
      </header>
      <div role="tablist" aria-label="Severity" className="flex gap-2 overflow-x-auto px-4 pb-3">
        {EVENT_TABS.map((option) => (
          <button
            key={option.id}
            role="tab"
            type="button"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              "shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[15px]",
              tab === option.id ? "border-accent-line bg-accent-soft font-semibold text-ink" : "border-line text-ink-2"
            )}
          >
            {option.label} <span className="text-muted">{events.filter((event) => option.kinds.includes(event.kind)).length}</span>
          </button>
        ))}
      </div>
      <ul className="border-t border-line">
        {shown.length === 0 && <li className="px-4 py-6 text-sm text-muted">No events match.</li>}
        {shown.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            history={history}
            actions={actions}
            onSelect={() =>
              event.kind === "anomaly" && event.alarmId
                ? onOpenAnomaly(event.alarmId)
                : selectLogEvent(event.id === selectedEventId ? null : event.id)
            }
            onFocus={() => undefined}
            onAsk={onAsk}
            onShowTimeSeries={() => undefined}
          />
        ))}
      </ul>
    </div>
  );
}
