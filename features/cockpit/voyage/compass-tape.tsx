import { formatBearing } from "@/features/live-data/lib/format-readings";
import { wrapSigned } from "../lib/voyage-math";

type Props = { headingDeg: number; courseDeg: number };

/** Degrees shown either side of the heading, and between ticks and labels. */
const HALF_SPAN_DEG = 30;
const TICK_DEG = 5;
const LABEL_DEG = 10;
/** The tape's width, CSS pixels. */
const WIDTH_PX = 480;
const PX_PER_DEG = WIDTH_PX / (HALF_SPAN_DEG * 2);

/**
 * Over the scene's top, in Voyage: the heading on a moving compass tape, the
 * course over ground marked on it, and both read out underneath.
 */
export function CompassTape({ headingDeg, courseDeg }: Props) {
  const first = Math.ceil((headingDeg - HALF_SPAN_DEG) / TICK_DEG) * TICK_DEG;
  const ticks = Array.from({ length: (HALF_SPAN_DEG * 2) / TICK_DEG + 1 }, (_, index) => first + index * TICK_DEG).filter(
    (degrees) => Math.abs(degrees - headingDeg) <= HALF_SPAN_DEG
  );
  const courseOffset = wrapSigned(courseDeg - headingDeg);

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-1.5 lg:flex">
      <div
        className="relative h-[58px] overflow-hidden rounded-[10px] border border-glass-line bg-glass backdrop-blur"
        style={{ width: WIDTH_PX }}
        aria-label={`Heading ${formatBearing(headingDeg)}`}
      >
        {ticks.map((degrees) => {
          const x = WIDTH_PX / 2 + (degrees - headingDeg) * PX_PER_DEG;
          const isLabelled = ((degrees % LABEL_DEG) + LABEL_DEG) % LABEL_DEG === 0;
          return (
            <div key={degrees} className="absolute top-0 flex h-full flex-col items-center" style={{ left: x, transform: "translateX(-50%)" }}>
              {isLabelled && (
                <span className="pt-2 font-mono text-[11px] text-ink-2">{formatBearing(((degrees % 360) + 360) % 360).replace("°", "")}</span>
              )}
              <span className={`mt-auto w-px bg-muted ${isLabelled ? "h-4" : "h-2.5"}`} />
            </div>
          );
        })}
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent" aria-hidden />
        {Math.abs(courseOffset) <= HALF_SPAN_DEG && (
          <span
            className="absolute bottom-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[8px] border-x-transparent border-b-warn"
            style={{ left: WIDTH_PX / 2 + courseOffset * PX_PER_DEG }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-col items-center rounded-lg border border-accent-line bg-glass px-3 py-1 backdrop-blur">
        <span className="font-mono text-xl leading-tight font-semibold">{formatBearing(headingDeg)}</span>
        <span className="text-[10px] tracking-[0.06em] text-muted">
          HDG · <span className="text-warn">COG {formatBearing(courseDeg)}</span>
        </span>
      </div>
    </div>
  );
}
