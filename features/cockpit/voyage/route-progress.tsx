import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { distanceMadeGood, etaHours, formatHours } from "../lib/voyage-math";

/** Along the scene's bottom right, in Voyage: how far along its route the ship is, with the route's waypoints. */
export function RouteProgress({ snapshot }: { snapshot: LiveSnapshot }) {
  const { voyage, navigation } = snapshot;
  const share = (nauticalMiles: number) => `${(nauticalMiles / voyage.totalNm) * 100}%`;
  const madeGood = distanceMadeGood(voyage);
  const progressPct = (madeGood / voyage.totalNm) * 100;

  return (
    <section
      aria-label="Route progress"
      className="pointer-events-auto flex w-[500px] flex-col gap-2.5 rounded-[10px] border border-glass-line bg-glass px-4 py-3 text-ink backdrop-blur"
    >
      <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
        <span className="font-semibold">{voyage.origin}</span>
        <span className="text-muted">
          {progressPct.toFixed(0)}% · DTG {voyage.distanceToGoNm.toFixed(1)} nm · ETA{" "}
          {formatHours(etaHours(voyage, navigation.speedOverGroundKn))}
        </span>
        <span className="font-semibold">{voyage.destination}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-track">
        <div className="h-full rounded-full bg-accent" style={{ width: share(madeGood) }} />
        {voyage.waypoints.map((waypoint) => (
          <span
            key={waypoint.name}
            title={waypoint.name}
            className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 bg-ink-2"
            style={{ left: share(waypoint.atNm) }}
          />
        ))}
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white"
          style={{ left: share(madeGood) }}
          aria-hidden
        />
      </div>
    </section>
  );
}
