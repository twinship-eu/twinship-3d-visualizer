"use client";

import { Activity, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { askAssistant } from "@/features/assistant/lib/assistant-store";
import { acknowledgeAlarm } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import type { Alarm } from "@/features/live-data/live-data-types";
import { closeAnomaly } from "../lib/anomaly-store";
import { AnomalyScope } from "./anomaly-scope";

type Props = {
  alarm: Alarm;
  /** Opens the ship assistant, the question asked. */
  onAsk: (question: string) => void;
  /** Opens the event log. */
  onOpenLog: () => void;
  /** The phone's page, under the scene's card, rather than beside the scene at lg. */
  isPhonePage?: boolean;
};

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

/** A share as a bar: what drives the anomaly, or a group that contributes. */
function ShareBar({ label, note, share }: { label: string; note: string; share: number }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2 text-sm">
        <span className="size-1.5 shrink-0 self-center rounded-full bg-anomaly" aria-hidden />
        <span className="min-w-0 grow truncate">{label}</span>
        <span className="shrink-0 text-xs text-anomaly-ink">{note}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="relative h-1.5 grow rounded-full bg-track">
          <span className="absolute inset-y-0 left-0 rounded-full bg-anomaly" style={{ width: `${share}%` }} />
        </span>
        <span className="w-9 shrink-0 text-right font-mono text-xs text-ink-2">{share}%</span>
      </span>
    </li>
  );
}

/**
 * A behaviour anomaly in full, beside the scene: its scope, why it is flagged
 * on the group or the ship, what drives it (or which groups contribute), the
 * likely causes, the next steps — and the way to acknowledge it, dismiss it
 * as not an issue, or find it in the log.
 */
export function AnomalyPanel({ alarm, onAsk, onOpenLog, isPhonePage = false }: Props) {
  const anomaly = alarm.anomaly;
  if (!anomaly) return null;
  const isShip = alarm.scope === "ship";
  const ask = () => {
    const question = `Explain the ${isShip ? "whole-ship" : "group"} anomaly "${alarm.title}" (${anomaly.name}): what drives it and what should I check?`;
    askAssistant(question);
    onAsk(question);
  };

  return (
    <aside
      aria-label={`${anomaly.name} anomaly`}
      className={
        isPhonePage
          ? "flex flex-col bg-surface text-ink lg:hidden"
          : "hidden w-[420px] shrink-0 flex-col border-l border-line bg-surface text-ink lg:flex"
      }
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="size-5 shrink-0 text-anomaly" aria-hidden />
          <h2 className="min-w-0 grow truncate text-2xl font-bold">{anomaly.name}</h2>
          {!isPhonePage && (
            <button
              type="button"
              onClick={closeAnomaly}
              aria-label="Close the anomaly"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-btn hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="rounded-md bg-anomaly px-2 py-0.5 text-xs font-bold text-black">BEHAVIOUR ANOMALY</span>
          inside limits, outside the model
        </p>
        <AnomalyScope scope={alarm.scope ?? "group"} isBehaviour />
        <p className="text-[13px] text-ink-2">
          <b className="text-ink">{isShip ? "The vessel as a whole: " : `${anomaly.members.length} components that work together: `}</b>
          {isShip ? anomaly.why : `${anomaly.members.join(" → ")}.`}
        </p>
      </header>

      <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-6 py-5 text-sm">
        {!isShip && (
          <section className="flex flex-col gap-2 rounded-xl border border-anomaly-line bg-anomaly-soft p-4">
            <p>
              <b>Why it&apos;s flagged on the group: </b>
              {anomaly.why}
            </p>
            <p className="font-mono text-xs text-muted">
              Raised {formatUtcTime(alarm.raisedAt)} · {alarm.isAcknowledged ? "acknowledged" : "unacknowledged"}
            </p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h3 className={SECTION_LABEL_CLASS}>{isShip ? "CONTRIBUTING GROUPS · share of the anomaly" : "WHAT DRIVES IT · share of the anomaly"}</h3>
          <ul className="flex flex-col gap-3">
            {anomaly.shares.map((share) => (
              <ShareBar key={share.label} {...share} />
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL_CLASS}>LIKELY CAUSES · pattern match</h3>
          {anomaly.causes.map((cause, index) => (
            <div
              key={cause.title}
              className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", index === 0 ? "border-anomaly-line" : "border-line")}
            >
              <span className="flex min-w-0 grow flex-col">
                <span className="font-semibold">{cause.title}</span>
                <span className="text-xs text-muted">{cause.detail}</span>
              </span>
              <span className={cn("shrink-0 font-mono font-semibold", index === 0 ? "text-anomaly-ink" : "text-ink-2")}>{cause.share}%</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL_CLASS}>NEXT STEPS</h3>
          {anomaly.nextSteps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={index === 0 ? ask : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-left font-semibold",
                index === 0 ? "cursor-pointer hover:border-accent-line" : "cursor-default"
              )}
            >
              <span className="grow">{step}</span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </button>
          ))}
        </section>
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-line p-4">
        <button
          type="button"
          disabled={alarm.isAcknowledged}
          // Acknowledged, it is the operator's: it stops glowing and the panel closes
          onClick={() => {
            acknowledgeAlarm(alarm.id);
            closeAnomaly();
          }}
          className="flex h-11 grow cursor-pointer items-center justify-center rounded-lg bg-anomaly text-sm font-semibold text-black hover:brightness-110 disabled:cursor-default disabled:opacity-50"
        >
          {alarm.isAcknowledged ? "Acknowledged" : "Acknowledge"}
        </button>
        <button
          type="button"
          onClick={() => {
            acknowledgeAlarm(alarm.id);
            closeAnomaly();
          }}
          className="h-11 cursor-pointer rounded-lg border border-line-strong px-4 text-sm font-semibold hover:border-accent-line"
        >
          Not an issue
        </button>
        <button type="button" onClick={onOpenLog} className="h-11 cursor-pointer rounded-lg border border-line-strong px-4 text-sm font-semibold hover:border-accent-line">
          Log
        </button>
      </footer>
    </aside>
  );
}
