"use client";

import { Navigation2 } from "lucide-react";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { distanceMadeGood, etaHours, formatHours, relativeWind } from "../lib/voyage-math";

const LABEL_CLASS = "text-[10px] font-semibold tracking-[0.08em] text-muted";
const VALUE_CLASS = "font-mono text-[15px] font-semibold tabular-nums whitespace-nowrap";

/**
 * The navigation layer's part of the bar under the ship: the wind as the ship
 * feels it, and the route's progress. The heading, course and rate of turn
 * are over the scene's top (`HeadingCard`), roll and pitch in its attitude
 * card, heading, speed, true wind and position in the top bar: no value twice.
 */
export function NavigationStrip({ snapshot }: { snapshot: LiveSnapshot }) {
  const { navigation, voyage } = snapshot;
  const wind = relativeWind(navigation);
  const progressPct = (distanceMadeGood(voyage) / voyage.totalNm) * 100;

  return (
    // As the bar narrows (the log or the assistant open beside the scene), the route gives way, then the wind
    <div className="hidden min-w-0 items-center gap-5 border-l border-line pl-4 @[640px]:flex">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full border border-line-strong">
          <Navigation2 className="size-4 text-accent" style={{ transform: `rotate(${wind.angleDeg + 180}deg)` }} aria-hidden />
        </span>
        <div className="flex w-[64px] flex-col">
          <span className={LABEL_CLASS}>WIND REL</span>
          <span className={VALUE_CLASS}>{`${Math.abs(wind.angleDeg).toFixed(0)}° ${wind.angleDeg < 0 ? "P" : "S"}`}</span>
        </div>
      </div>
      <div className="hidden w-[180px] shrink-0 flex-col gap-1 pr-2 @[820px]:flex">
        <span className="flex justify-between">
          <span className={`${LABEL_CLASS} tabular-nums`}>ROUTE {progressPct.toFixed(0)}%</span>
          <span className={`${LABEL_CLASS} tabular-nums`}>ETA {formatHours(etaHours(voyage, navigation.speedOverGroundKn))}</span>
        </span>
        <span className="relative h-1 rounded-full bg-track">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        </span>
        <span className={`${LABEL_CLASS} tabular-nums`}>DTG {voyage.distanceToGoNm.toFixed(1)} nm</span>
      </div>
    </div>
  );
}
