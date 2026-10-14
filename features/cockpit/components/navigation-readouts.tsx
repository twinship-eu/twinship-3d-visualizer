import { formatBearing, formatKnots, formatPosition } from "@/features/live-data/lib/format-readings";
import type { NavigationState } from "@/features/live-data/live-data-types";

/** Shown in place of a reading not received yet. */
const NO_READING = "—";

type Readout = { label: string; value: string };

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
    },
  ];
}

/**
 * The ship's heading, speed, wind and position, in the top bar. Where the bar
 * has no room for them all, the last ones give way, whole: they wrap onto a
 * second line the bar's height hides, so the bar never runs off the window.
 */
export function NavigationReadouts({ navigation }: { navigation: NavigationState | null }) {
  return (
    <div className="hidden h-[38px] min-w-0 flex-wrap items-stretch overflow-hidden lg:flex">
      {readoutsFor(navigation).map(({ label, value }) => (
        <div key={label} className="flex h-full flex-col justify-center border-l border-line px-3 first:border-l-0 first:pl-0">
          <span className="text-[10px] tracking-[0.1em] text-muted">{label}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}
