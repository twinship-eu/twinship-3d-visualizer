"use client";

import { Sun, Waves } from "lucide-react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { SEASCAPE_WIND_LIMITS } from "../lib/seascape-config";
import { describeSunHeight, sunForClock } from "../lib/sun-for-clock";
import { followDataSky, ONTOLOGY_DEFAULT_HOUR_UTC, setSkyHour, useSkyControls } from "../lib/sky-controls-store";
import { DEFAULT_SEA, followDataSea, setSeaWavesFrom, setSeaWindSpeed, useSeaControls } from "../lib/sea-controls-store";

const METRES_PER_SECOND_PER_KNOT = 0.514444;
/** The upper wind speeds of Beaufort's forces 0 to 11, m/s: past the last, force 12. */
const BEAUFORT_UPPER_MS = [0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
/** Within this many degrees of the bow or the stern, the waves are ahead or astern. */
const AHEAD_DEG = 5;

const beaufortOf = (speedMs: number) => {
  const force = BEAUFORT_UPPER_MS.findIndex((upper) => speedMs < upper);
  return force === -1 ? BEAUFORT_UPPER_MS.length : force;
};

/** "23° port", "ahead", "astern". */
function sideLabel(fromRelativeDeg: number) {
  const off = Math.abs(fromRelativeDeg);
  if (off <= AHEAD_DEG) return "ahead";
  if (off >= 180 - AHEAD_DEG) return "astern";
  return `${off.toFixed(0)}° ${fromRelativeDeg > 0 ? "starboard" : "port"}`;
}

/** The data's wind, as the sea takes it: its speed, m/s, and the side it comes from, degrees off the bow. */
function useDataWind() {
  const snapshot = useLiveData();
  if (!snapshot) return null;
  const { trueWind, headingDeg } = snapshot.navigation;
  const side = ((((trueWind.fromDeg - headingDeg) % 360) + 540) % 360) - 180;
  return { speedMs: trueWind.speedKn * METRES_PER_SECOND_PER_KNOT, fromRelativeDeg: side };
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** "06:30": an hour of the day, from 0 to 24. */
function clockLabel(hour: number) {
  const minutes = Math.round(hour * MINUTES_PER_HOUR) % (HOURS_PER_DAY * MINUTES_PER_HOUR);
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

/**
 * Over the scene in the Ontology: the sea and the sky, set by the user — the
 * wind's speed, the side its waves come from, the hour of the day. Each starts
 * at the live data's, and at the scene's own without data; "Use live data"
 * hands them back to it.
 */
export function SeaControlsCard() {
  const controls = useSeaControls();
  const sky = useSkyControls();
  const snapshot = useLiveData();
  const data = useDataWind();
  // The Ontology opens at a high sun, whatever the data's clock; the user's hour replaces it
  const hour = sky.hourUtc ?? ONTOLOGY_DEFAULT_HOUR_UTC;
  const sun = sunForClock(snapshot?.observedAt ?? null, hour, snapshot?.navigation.position ?? null);
  const speedMs = controls.speedMs ?? data?.speedMs ?? DEFAULT_SEA.speedMs;
  const side = controls.fromRelativeDeg ?? data?.fromRelativeDeg ?? DEFAULT_SEA.fromRelativeDeg;
  const isUsersOwn = controls.speedMs !== null || controls.fromRelativeDeg !== null || sky.hourUtc !== null;

  return (
    <section
      aria-label="Sea state"
      className="pointer-events-auto absolute top-4 left-4 z-20 hidden w-[272px] flex-col gap-3 rounded-[10px] border border-glass-line bg-glass px-4 py-3.5 text-ink backdrop-blur lg:flex"
    >
      <header className="flex items-center gap-2">
        <Waves className="size-4 text-accent-ink" aria-hidden />
        <h2 className="grow text-[11px] font-semibold tracking-[0.12em] text-muted">SEA</h2>
        <span className="text-[11px] text-muted">{isUsersOwn ? "set by you" : data ? "from live data" : "default"}</span>
      </header>

      <label className="flex flex-col gap-1.5 text-[13px]">
        <span className="flex justify-between">
          <span className="text-ink-2">Wind</span>
          <span className="font-mono font-semibold">
            {(speedMs / METRES_PER_SECOND_PER_KNOT).toFixed(0)} kn · {speedMs.toFixed(0)} m/s · Bft {beaufortOf(speedMs)}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={SEASCAPE_WIND_LIMITS.maxSpeed}
          step={0.5}
          value={speedMs}
          onChange={(event) => setSeaWindSpeed(Number(event.target.value))}
          className="w-full cursor-pointer accent-[var(--color-accent)]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px]">
        <span className="flex justify-between">
          <span className="text-ink-2">Waves from</span>
          <span className="font-mono font-semibold">{sideLabel(side)}</span>
        </span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={side}
          onChange={(event) => setSeaWavesFrom(Number(event.target.value))}
          className="w-full cursor-pointer accent-[var(--color-accent)]"
        />
        <span className="flex justify-between text-[11px] text-muted">
          <span>port</span>
          <span>ahead</span>
          <span>starboard</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-[13px]">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-ink-2">
            <Sun className="size-3.5" aria-hidden />
            Time (UTC)
          </span>
          <span className="font-mono font-semibold">
            {clockLabel(hour)}
            {` · ${sun.elevationDeg.toFixed(0)}° · ${describeSunHeight(sun.elevationDeg)}`}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={HOURS_PER_DAY}
          step={1 / MINUTES_PER_HOUR}
          value={hour}
          onChange={(event) => setSkyHour(Number(event.target.value))}
          className="w-full cursor-pointer accent-[var(--color-accent)]"
        />
      </label>

      {isUsersOwn && (
        <button
          type="button"
          onClick={() => {
            followDataSea();
            followDataSky();
          }}
          className="cursor-pointer self-start text-[13px] font-semibold text-accent-ink hover:text-accent"
        >
          {data ? "Use live data" : "Back to default"}
        </button>
      )}
    </section>
  );
}
