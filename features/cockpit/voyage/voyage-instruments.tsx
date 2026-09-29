import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { relativeWind } from "../lib/voyage-math";

const CARD_CLASS =
  "pointer-events-auto flex flex-col rounded-[10px] border border-glass-line bg-glass px-4 py-3.5 text-ink backdrop-blur";
const LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-muted";

/** A label and its reading, as the instruments list them. */
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-muted">
      {label} <b className="font-mono text-[13px] font-semibold text-ink">{value}</b>
    </span>
  );
}

/** The ship's way: speed over ground against its eco and design speeds, and how it steers. */
export function MotionCard({ snapshot }: { snapshot: LiveSnapshot }) {
  const { navigation, voyage } = snapshot;
  const share = (knots: number) => `${Math.min(knots / voyage.designSpeedKn, 1) * 100}%`;

  return (
    <section className={`${CARD_CLASS} w-[250px] gap-2`} aria-label="Motion">
      <span className={LABEL_CLASS}>MOTION</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-[40px] leading-none font-semibold">{navigation.speedOverGroundKn.toFixed(1)}</span>
        <span className="text-sm text-muted">kn SOG</span>
      </span>
      <div className="relative mt-1 h-1.5 rounded-full bg-track">
        <div className="h-full rounded-full bg-accent" style={{ width: share(navigation.speedOverGroundKn) }} />
        <span className="absolute -top-1 h-3.5 w-0.5 bg-ok" style={{ left: share(voyage.ecoSpeedKn) }} aria-hidden />
      </div>
      <div className="relative h-3 font-mono text-[10px] text-muted">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2 text-ok" style={{ left: share(voyage.ecoSpeedKn) }}>
          eco {voyage.ecoSpeedKn}
        </span>
        <span className="absolute right-0">{voyage.designSpeedKn} design</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        <Reading label="STW" value={`${navigation.speedThroughWaterKn.toFixed(1)} kn`} />
        <Reading label="ROT" value={`${navigation.rateOfTurnDegPerMin.toFixed(1)}°/min`} />
        <Reading label="Rudder" value={`${navigation.rudderDeg.toFixed(1)}°`} />
        <Reading label="Drift" value={`${navigation.driftDeg.toFixed(1)}°`} />
      </div>
    </section>
  );
}

/** Pixels the horizon moves per degree of pitch, in the 100-unit disc. */
const HORIZON_PX_PER_DEG = 4;

/** Roll and pitch on an artificial horizon, with heave and the roll's period. */
export function AttitudeCard({ snapshot }: { snapshot: LiveSnapshot }) {
  const { rollDeg, pitchDeg, heaveM, rollPeriodS } = snapshot.systems.hull;

  return (
    <section className={`${CARD_CLASS} w-[252px] gap-3`} aria-label="Attitude">
      <span className={LABEL_CLASS}>ATTITUDE</span>
      <div className="flex items-center gap-4">
        <svg viewBox="-50 -50 100 100" className="size-[104px] shrink-0" aria-hidden>
          <defs>
            <clipPath id="attitude-disc">
              <circle r="48" />
            </clipPath>
          </defs>
          <g clipPath="url(#attitude-disc)">
            <g transform={`rotate(${-rollDeg}) translate(0 ${pitchDeg * HORIZON_PX_PER_DEG})`}>
              <rect x="-80" y="-80" width="160" height="80" className="fill-accent/35" />
              <rect x="-80" y="0" width="160" height="80" className="fill-canvas" />
              <line x1="-80" x2="80" y1="0" y2="0" className="stroke-ink" strokeWidth="1.2" />
              <line x1="-10" x2="10" y1="-12" y2="-12" className="stroke-muted" strokeWidth="0.8" />
              <line x1="-10" x2="10" y1="12" y2="12" className="stroke-muted" strokeWidth="0.8" />
            </g>
            {/* The ship: fixed, the horizon moves about it */}
            <path d="M -22 0 H -7 L 0 5 L 7 0 H 22" fill="none" className="stroke-warn" strokeWidth="2.2" strokeLinejoin="round" />
          </g>
          <circle r="48" fill="none" className="stroke-line-strong" strokeWidth="1" />
        </svg>
        <div className="flex flex-col gap-2">
          <span className="flex flex-col">
            <span className="text-xs text-muted">Roll</span>
            <span className="font-mono text-xl font-semibold">{rollDeg.toFixed(1)}°</span>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-muted">Pitch</span>
            <span className="font-mono text-xl font-semibold">{pitchDeg.toFixed(1)}°</span>
          </span>
        </div>
      </div>
      <div className="flex justify-between">
        <Reading label="Heave" value={`±${heaveM.toFixed(1)} m`} />
        <Reading label="Roll period" value={`${rollPeriodS.toFixed(1)} s`} />
      </div>
    </section>
  );
}

/** The wind as the ship feels it, off the bow, and what the suction sails make of it. */
export function RelativeWindCard({ snapshot }: { snapshot: LiveSnapshot }) {
  const wind = relativeWind(snapshot.navigation);

  return (
    <section className={`${CARD_CLASS} w-[252px] flex-row items-center gap-3`} aria-label="Relative wind">
      <svg viewBox="-50 -50 100 100" className="size-16 shrink-0" aria-hidden>
        <circle r="46" fill="none" className="stroke-line-strong" strokeWidth="1.5" />
        {/* The bow, up */}
        <path d="M 0 -30 L 6 -18 L -6 -18 Z" className="fill-muted" />
        {/* The wind, coming in from its angle towards the ship */}
        <g transform={`rotate(${wind.angleDeg})`}>
          <line x1="0" y1="-44" x2="0" y2="-8" className="stroke-accent" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 -4 L 7 -14 L -7 -14 Z" className="fill-accent" />
        </g>
      </svg>
      <div className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>WIND · RELATIVE</span>
        <span className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="font-mono text-xl font-semibold">{wind.speedKn.toFixed(1)} kn</span>
          <span className="text-xs text-muted">
            · {Math.abs(wind.angleDeg).toFixed(0)}° {wind.angleDeg >= 0 ? "stbd" : "port"}
          </span>
        </span>
        <Reading label="Sail thrust" value={`${snapshot.systems.windAssist.thrustKn.toFixed(0)} kN`} />
      </div>
    </section>
  );
}
