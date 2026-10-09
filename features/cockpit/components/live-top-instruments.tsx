"use client";

import { formatBearing } from "@/features/live-data/lib/format-readings";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { useOpenAnomaly } from "@/features/anomalies/lib/anomaly-store";
import { AttitudeCard } from "../voyage/voyage-instruments";
import { wrapSigned } from "../lib/voyage-math";

/** The heading tape: degrees either side of the heading, between ticks and between labels, and its width in px. */
const HALF_SPAN_DEG = 25;
const TICK_DEG = 5;
const LABEL_DEG = 10;
const TAPE_WIDTH_PX = 300;
const PX_PER_DEG = TAPE_WIDTH_PX / (HALF_SPAN_DEG * 2);

const LABEL_CLASS = "text-[10px] font-semibold tracking-[0.1em]";
const VALUE_CLASS = "font-mono text-lg leading-tight font-semibold tabular-nums whitespace-nowrap";

/** The heading on a moving tape, the course over ground marked on it. */
function HeadingTape({ headingDeg, courseDeg }: { headingDeg: number; courseDeg: number }) {
  const first = Math.ceil((headingDeg - HALF_SPAN_DEG) / TICK_DEG) * TICK_DEG;
  const ticks = Array.from({ length: (HALF_SPAN_DEG * 2) / TICK_DEG + 1 }, (_, index) => first + index * TICK_DEG).filter(
    (degrees) => Math.abs(degrees - headingDeg) <= HALF_SPAN_DEG
  );
  const courseOffset = wrapSigned(courseDeg - headingDeg);

  return (
    <div
      className="relative h-11 shrink-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      style={{ width: TAPE_WIDTH_PX }}
      aria-label={`Heading ${formatBearing(headingDeg)}`}
    >
      {ticks.map((degrees) => {
        const isLabelled = ((degrees % LABEL_DEG) + LABEL_DEG) % LABEL_DEG === 0;
        return (
          <div
            key={degrees}
            className="absolute top-0 flex h-full flex-col items-center"
            style={{ left: TAPE_WIDTH_PX / 2 + (degrees - headingDeg) * PX_PER_DEG, transform: "translateX(-50%)" }}
          >
            {isLabelled && <span className="font-mono text-[11px] text-ink-2">{formatBearing(((degrees % 360) + 360) % 360).replace("°", "")}</span>}
            <span className={`mt-auto mb-1 w-px bg-muted ${isLabelled ? "h-3" : "h-2"}`} />
          </div>
        );
      })}
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent" aria-hidden />
      {Math.abs(courseOffset) <= HALF_SPAN_DEG && (
        <span
          className="absolute bottom-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[8px] border-x-transparent border-b-warn"
          style={{ left: TAPE_WIDTH_PX / 2 + courseOffset * PX_PER_DEG }}
          aria-hidden
        />
      )}
    </div>
  );
}

/** Over the scene's top centre: course over ground, the heading tape, the rate of turn. */
function HeadingCard({ snapshot }: { snapshot: LiveSnapshot }) {
  const { navigation } = snapshot;

  return (
    <section
      data-callout-avoid
      aria-label="Heading"
      className="pointer-events-auto flex items-center gap-4 rounded-[10px] border border-glass-line bg-glass px-4 py-1.5 text-ink backdrop-blur"
    >
      <span className="flex w-[52px] shrink-0 flex-col">
        <span className={`${LABEL_CLASS} text-warn`}>COG</span>
        <span className={VALUE_CLASS}>{formatBearing(navigation.courseOverGroundDeg)}</span>
      </span>
      <HeadingTape headingDeg={navigation.headingDeg} courseDeg={navigation.courseOverGroundDeg} />
      <span className="flex w-[96px] shrink-0 flex-col items-end">
        <span className={`${LABEL_CLASS} text-muted`}>ROT</span>
        <span className={VALUE_CLASS}>
          {navigation.rateOfTurnDegPerMin.toFixed(1)} <span className="text-xs font-normal text-muted">°/min</span>
        </span>
      </span>
    </section>
  );
}

/**
 * The navigation layer over the scene's top, as on a bridge's displays: the
 * heading in the middle, the attitude on the right. As the scene narrows
 * (the log or the assistant open beside it) the attitude gives way, then the
 * heading. An open behaviour anomaly's banner takes the top: they give way to it.
 */
export function LiveTopInstruments() {
  const snapshot = useLiveData();
  const anomaly = useOpenAnomaly();
  if (!snapshot || anomaly) return null;

  return (
    <div className="@container pointer-events-none absolute inset-x-4 top-4 z-20 hidden lg:block">
      <div className="absolute top-0 left-1/2 hidden -translate-x-1/2 @[860px]:block">
        <HeadingCard snapshot={snapshot} />
      </div>
      <div data-callout-avoid className="absolute top-0 right-0 hidden @[1120px]:block">
        <AttitudeCard attitude={snapshot.systems.hull} />
      </div>
    </div>
  );
}
