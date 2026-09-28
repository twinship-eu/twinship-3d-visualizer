import { cn } from "@/lib/utils";
import { formatBearing, formatKnots, formatPosition } from "@/features/live-data/lib/format-readings";
import type { NavigationState } from "@/features/live-data/live-data-types";

/** Shown in place of a reading not received yet. */
const NO_READING = "—";

type Readout = { label: string; value: string; className?: string };

function readoutsFor(navigation: NavigationState | null): Readout[] {
  return [
    { label: "HDG", value: navigation ? formatBearing(navigation.headingDeg) : NO_READING },
    { label: "SOG", value: navigation ? formatKnots(navigation.speedOverGroundKn) : NO_READING },
    {
      label: "TRUE WIND",
      value: navigation
        ? `${formatKnots(navigation.trueWind.speedKn)} · ${formatBearing(navigation.trueWind.fromDeg)}`
        : NO_READING,
    },
    {
      label: "POSITION",
      value: navigation?.position ? formatPosition(navigation.position) : NO_READING,
      // The widest: shown only where the bar has room for it
      className: "hidden xl:flex",
    },
  ];
}

/** The ship's heading, speed, wind and position, in the top bar. */
export function NavigationReadouts({ navigation }: { navigation: NavigationState | null }) {
  return (
    <div className="hidden h-[38px] shrink-0 items-stretch overflow-hidden rounded-lg border border-line lg:flex">
      {readoutsFor(navigation).map(({ label, value, className }) => (
        <div
          key={label}
          className={cn(
            "flex flex-col justify-center border-r border-line px-3 last:border-r-0",
            className
          )}
        >
          <span className="text-[10px] tracking-[0.1em] text-muted">{label}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}
