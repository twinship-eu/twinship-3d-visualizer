"use client";

import { cn } from "@/lib/utils";
import { useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import type { TrendCard } from "./component-live-types";
import { TrendChart } from "./trend-chart";

type Props = {
  title: string;
  caption: string;
  /** The Tailwind class of the title's dot. */
  dotClass: string;
  cards: TrendCard[];
  /** Outlines the first card, as the reading in focus. */
  isFirstHighlighted?: boolean;
};

/**
 * Each line colour's text counterpart, for a series' name in the card's
 * title. Spelled out, not derived: Tailwind only emits classes it finds in
 * the source.
 */
const SERIES_TEXT_CLASSES: Record<string, string> = {
  "stroke-warn": "text-warn",
  "stroke-accent": "text-accent",
  "stroke-system-propeller": "text-system-propeller",
  "stroke-system-hull": "text-system-hull",
  "stroke-system-energy": "text-system-energy",
};
const textClassOf = (strokeClass: string) => SERIES_TEXT_CLASSES[strokeClass] ?? "text-ink";

function TrendCardView({ card, history, isHighlighted }: { card: TrendCard; history: LiveSnapshot[]; isHighlighted: boolean }) {
  const latest = history[history.length - 1];
  const namedSeries = card.series.filter((series) => series.label);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[10px] border bg-card px-3.5 py-3",
        isHighlighted ? "border-warn-line" : "border-line"
      )}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted">
          {card.title}
          {namedSeries.length > 0 && " · "}
          {namedSeries.map((series, index) => (
            <span key={series.label} className={textClassOf(series.strokeClass)}>
              {index > 0 && <span className="text-muted"> / </span>}
              {series.label}
            </span>
          ))}
          {card.note && <span className="text-ok"> · {card.note}</span>}
        </span>
        <span className={cn("shrink-0 font-mono font-semibold", isHighlighted ? "text-warn" : "text-ink")}>
          {latest ? card.format(card.series.map((series) => series.value(latest))) : "—"}
        </span>
      </div>
      <TrendChart
        lines={card.series.map((series) => ({ values: history.map(series.value), strokeClass: series.strokeClass }))}
        limits={card.limits}
        className="min-h-0 w-full grow"
      />
    </div>
  );
}

/**
 * Under the scene, with a component in focus: a few of its readings over the
 * last minute — or, with an alarm in focus, the reading and what drives it.
 */
export function ComponentTrendsStrip({ title, caption, dotClass, cards, isFirstHighlighted = false }: Props) {
  const history = useLiveHistory();

  return (
    <section
      aria-label={title}
      className="hidden h-[210px] shrink-0 flex-col gap-2.5 border-t border-line bg-surface px-4 py-3.5 lg:flex"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("size-[7px] rounded-full", dotClass)} aria-hidden />
        <span className="font-bold">{title}</span>
        <span className="text-muted">{caption}</span>
      </div>
      <div className="grid min-h-0 grow grid-cols-3 gap-3">
        {cards.map((card, index) => (
          <TrendCardView key={card.title} card={card} history={history} isHighlighted={isFirstHighlighted && index === 0} />
        ))}
      </div>
    </section>
  );
}
