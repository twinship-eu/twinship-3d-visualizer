"use client";

import { cn } from "@/lib/utils";
import { getActiveAlarms, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { SYSTEM_CARDS, systemsInWarning, type SystemCard } from "../cockpit-systems";
import { Sparkline } from "./sparkline";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";

type CardProps = {
  card: SystemCard;
  history: LiveSnapshot[];
  isWarning: boolean;
  showsStatus: boolean;
};

function SystemCardView({ card, history, isWarning, showsStatus }: CardProps) {
  const latest = history[history.length - 1];
  const [first, second] = card.readings;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[10px] border bg-card px-3.5 py-3",
        isWarning ? "border-warn-line" : "border-line"
      )}
    >
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className={cn("size-[7px] shrink-0 rounded-full", card.dotClass)} aria-hidden />
        <span className="grow truncate font-semibold">{card.title}</span>
        {showsStatus && (
          <span className={cn("text-[11px] font-semibold tracking-[0.06em]", isWarning ? "text-warn" : "text-ok")}>
            {isWarning ? "WARNING" : "NORMAL"}
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <span className="flex shrink-0 items-baseline gap-1">
          <span className={cn("font-mono text-[26px] leading-none font-semibold tabular-nums", isWarning && "text-warn")}>
            {latest && (card.isAvailable?.(latest) ?? true) ? card.format(card.value(latest)) : "—"}
          </span>
          <span className="text-[11px] text-muted">{card.unit}</span>
        </span>
        <Sparkline values={history.map(card.value)} strokeClass={card.strokeClass} className="h-7 min-w-0 grow" />
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted">
        <span className="truncate">
          {first.label} <span className="font-mono font-semibold text-ink-2">{latest ? first.value(latest) : "—"}</span>
        </span>
        <span className="truncate">
          {second.label} <span className="font-mono font-semibold text-ink-2">{latest ? second.value(latest) : "—"}</span>
        </span>
      </div>
    </div>
  );
}

type Props = {
  /** The cards, left to right: the systems' by default. */
  cards?: SystemCard[];
  /** Whether each card says if its system is normal: the systems' do. */
  showsStatus?: boolean;
};

/**
 * Under the scene, in Live data: a card for each of the ship's systems — its
 * main reading, its last minute, two more readings and whether it is normal
 * — or the Voyage view's cards, the same way.
 */
export function SystemCardsStrip({ cards = SYSTEM_CARDS, showsStatus = true }: Props) {
  const history = useLiveHistory();
  const latest = history[history.length - 1] ?? null;
  const warning = systemsInWarning(getActiveAlarms(latest));

  return (
    <section
      aria-label="Ship systems"
      className="hidden h-[170px] shrink-0 grid-cols-5 gap-3 border-t border-line bg-surface px-4 py-3.5 lg:grid"
    >
      {cards.map((card) => (
        <SystemCardView
          key={card.id}
          card={card}
          history={history}
          isWarning={showsStatus && warning.has(card.id)}
          showsStatus={showsStatus}
        />
      ))}
    </section>
  );
}
