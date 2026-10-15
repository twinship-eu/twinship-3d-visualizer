"use client";

import { useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import type { Alarm, LiveSnapshot } from "@/features/live-data/live-data-types";
import { TrendChart } from "@/features/cockpit/component-live/trend-chart";
import { fuelPerMileKg } from "@/features/cockpit/lib/voyage-math";
import { useAnomalyScoreHistory } from "../lib/anomaly-store";

/** The signals each scope's strip shows beside the score: what the model judges it on. */
const SIGNALS: Record<"group" | "ship", { title: string; unit: string; strokeClass: string; read: (snapshot: LiveSnapshot) => number }[]> = {
  group: [
    { title: "Shaft power for this speed", unit: "MW", strokeClass: "stroke-system-propeller", read: (snapshot) => snapshot.systems.propulsion.powerMw },
    { title: "Fuel per nautical mile", unit: "kg/nm", strokeClass: "stroke-accent", read: (snapshot) => fuelPerMileKg(snapshot) ?? 0 },
  ],
  ship: [
    { title: "Roll", unit: "°", strokeClass: "stroke-system-hull", read: (snapshot) => snapshot.systems.hull.rollDeg },
    { title: "Pitch", unit: "°", strokeClass: "stroke-ok", read: (snapshot) => snapshot.systems.hull.pitchDeg },
  ],
};

const CARD_CLASS = "flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3";

/**
 * Under the scene while a behaviour anomaly is open: its score against its
 * threshold, and the signals the model judges it on.
 */
export function AnomalyStrip({ alarm }: { alarm: Alarm }) {
  const history = useLiveHistory();
  const scores = useAnomalyScoreHistory(alarm.id);
  const anomaly = alarm.anomaly;
  if (!anomaly) return null;
  const signals = SIGNALS[alarm.scope === "ship" ? "ship" : "group"];

  return (
    <section aria-label="Behaviour against the model" className="hidden shrink-0 flex-col gap-2.5 border-t border-line bg-surface px-4 py-3.5 lg:flex">
      <p className="flex items-center gap-2 text-xs">
        <span className="size-[7px] rounded-full bg-anomaly" aria-hidden />
        <b>Behaviour vs model · live</b>
        <span className="text-muted">the score and the signals it is judged on · last 60 s</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className={`${CARD_CLASS} border-anomaly-line`}>
          <span className="flex justify-between text-xs">
            <span className="text-ink-2">Anomaly score · threshold {anomaly.threshold.toFixed(2)}</span>
            <span className="font-mono font-semibold text-anomaly-ink">{anomaly.score.toFixed(2)}</span>
          </span>
          <div className="relative h-16">
            <TrendChart
              lines={[{ values: scores, strokeClass: "stroke-anomaly" }]}
              limits={[{ value: anomaly.threshold, tone: "warn" }]}
              className="absolute inset-0 size-full"
            />
          </div>
        </div>
        {signals.map((signal) => {
          const values = history.map(signal.read);
          return (
            <div key={signal.title} className={`${CARD_CLASS} border-line`}>
              <span className="flex justify-between text-xs">
                <span className="text-ink-2">{signal.title}</span>
                <span className="font-mono font-semibold">
                  {values.length > 0 ? values[values.length - 1].toFixed(signal.unit === "kg/nm" ? 0 : 2) : "—"} {signal.unit}
                </span>
              </span>
              <div className="relative h-16">
                <TrendChart lines={[{ values, strokeClass: signal.strokeClass }]} className="absolute inset-0 size-full" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
