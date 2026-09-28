"use client";

import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { etaHours, formatHours, nextWaypoint } from "../lib/voyage-math";

/** Under the tree, in Voyage: the distance to go, the ETA, the next waypoint and the wind's saving. */
export function VoyageSummary() {
  const snapshot = useLiveData();
  if (!snapshot) return null;

  const { voyage, navigation, systems } = snapshot;
  const next = nextWaypoint(voyage);
  const rows = [
    { label: "Distance to go", value: `${voyage.distanceToGoNm.toFixed(1)} nm` },
    { label: "ETA at current speed", value: formatHours(etaHours(voyage, navigation.speedOverGroundKn)) },
    { label: "Next waypoint", value: next ? `${next.waypoint.name} · ${next.distanceNm.toFixed(1)} nm` : "—" },
    { label: "Fuel saved by WAPS", value: `${systems.windAssist.fuelSavingPct.toFixed(0)}%`, isGood: true },
  ];

  return (
    <section aria-label="Voyage" className="m-3.5 flex flex-col gap-2 rounded-[10px] border border-line bg-card px-4 py-3.5">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted">VOYAGE</h2>
      {rows.map(({ label, value, isGood }) => (
        <div key={label} className="flex justify-between gap-3 text-[13px]">
          <span className="shrink-0 text-ink-2">{label}</span>
          <span className={`text-right font-mono font-semibold ${isGood ? "text-ok" : ""}`}>{value}</span>
        </div>
      ))}
    </section>
  );
}
