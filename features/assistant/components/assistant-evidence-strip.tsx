"use client";

import { TrendChart } from "@/features/cockpit/component-live/trend-chart";
import { EVENT_KIND_CHIPS, TREND_LEAD_MINUTES } from "@/features/event-log/event-log-config";
import { useEventLog } from "@/features/event-log/hooks/use-event-log";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { findSensor } from "@/features/live-data/live-data-sensors";
import { useAssistantState } from "../lib/assistant-store";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-muted";

/** Minutes of trend shown when the answer cites no event to start from. */
const DEFAULT_TREND_MINUTES = 15;

type Props = { onOpenLog: () => void };

/**
 * Under the scene while the assistant is open: the data behind its last
 * answer — the sensor's trend it rests on, from a little before the cited
 * events, and those events themselves.
 */
export function AssistantEvidenceStrip({ onOpenLog }: Props) {
  const { latestReply } = useAssistantState();
  const { events, history } = useEventLog();
  if (!latestReply || (!latestReply.evidenceSensor && latestReply.citedEvents.length === 0)) return null;

  const cited = events.filter((event) => latestReply.citedEvents.includes(event.number));
  const sensor = latestReply.evidenceSensor ? findSensor(latestReply.evidenceSensor) : undefined;
  const latest = history[history.length - 1];
  const earliestCited = Math.min(...cited.map((event) => event.at));
  const from = Number.isFinite(earliestCited)
    ? earliestCited - TREND_LEAD_MINUTES * 60_000
    : (latest?.timestamp ?? 0) - DEFAULT_TREND_MINUTES * 60_000;
  const shown = sensor ? history.filter((snapshot) => snapshot.timestamp >= from && snapshot.sensors[sensor.id] !== undefined) : [];
  const start = shown[0]?.timestamp ?? 0;
  const span = (shown[shown.length - 1]?.timestamp ?? 0) - start || 1;
  const marker = Number.isFinite(earliestCited) ? Math.min(1, Math.max(0, (earliestCited - start) / span)) : null;

  return (
    <section aria-label="The answer's evidence" className="hidden h-[190px] shrink-0 gap-4 border-t border-line bg-surface px-4 py-3.5 lg:flex">
      {sensor && shown.length > 1 && (
        <div className="flex min-w-0 grow basis-0 flex-col gap-2 rounded-[10px] border border-line bg-card px-4 py-3">
          <div className="flex justify-between gap-2 text-xs">
            <span className={SECTION_LABEL_CLASS}>
              EVIDENCE · {sensor.id} {sensor.quantity.toLowerCase()} since {formatUtcTime(start).slice(0, 5)}
            </span>
            {sensor.warnAt !== undefined && <span className="text-warn">limit {sensor.warnAt}{sensor.unit}</span>}
          </div>
          <div className="relative min-h-0 grow">
            <TrendChart
              lines={[{ values: shown.map((snapshot) => snapshot.sensors[sensor.id] ?? 0), strokeClass: "stroke-warn" }]}
              limits={sensor.warnAt !== undefined ? [{ value: sensor.warnAt, tone: "warn" }] : []}
              className="absolute inset-0 size-full"
            />
            {marker !== null && (
              <>
                <span className="absolute inset-y-0 w-px bg-ink-2" style={{ left: `${marker * 100}%` }} aria-hidden />
                <span className="absolute top-0 ml-1 font-mono text-[11px] text-ink-2" style={{ left: `${marker * 100}%` }}>
                  start {formatUtcTime(earliestCited)}
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {cited.length > 0 && (
        <div className="flex min-w-0 grow basis-0 flex-col gap-1 rounded-[10px] border border-line bg-card px-4 py-3">
          <div className="flex justify-between">
            <span className={SECTION_LABEL_CLASS}>CITED EVENTS</span>
            <button type="button" onClick={onOpenLog} className="cursor-pointer text-[13px] font-semibold text-accent-ink hover:text-accent">
              Open log →
            </button>
          </div>
          <ul className="flex min-h-0 flex-col overflow-y-auto">
            {cited.map((event) => (
              <li key={event.id} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-0">
                <span className="font-mono text-muted">{formatUtcTime(event.at)}</span>
                <span className="min-w-0 grow truncate">{event.title}</span>
                <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-ink-2">{EVENT_KIND_CHIPS[event.kind].label.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
