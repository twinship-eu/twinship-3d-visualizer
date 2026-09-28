"use client";

import { ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAlarms, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { findSensor } from "@/features/live-data/live-data-sensors";
import type { Alarm } from "@/features/live-data/live-data-types";
import { SYSTEM_CARDS, systemsInWarning } from "../cockpit-systems";
import { Sparkline } from "../components/sparkline";
import { componentReading } from "../lib/component-readings";

/** The systems the phone's overview shows, two by two. */
const OVERVIEW_SYSTEMS = SYSTEM_CARDS.filter((card) => ["propulsion", "energy", "windAssist", "hull"].includes(card.id));
/** The components listed under them, each opening its live sheet. */
const OVERVIEW_COMPONENTS: { label: string; dotClass: string }[] = [
  { label: "Base Hull", dotClass: "bg-system-hull" },
  { label: "Engine", dotClass: "bg-system-energy" },
  { label: "WAPS", dotClass: "bg-system-hull" },
  { label: "Propellers", dotClass: "bg-system-propeller" },
  { label: "Container", dotClass: "bg-system-deck" },
  { label: "Crane", dotClass: "bg-system-deck" },
];
/** The hull card's reading on the phone: its bending stress, as in the design. */
const HULL_STRESS_SENSOR = "SG-03";

const SECTION_LABEL_CLASS = "px-1 text-xs font-semibold tracking-[0.14em] text-muted";

type Props = {
  onOpenAlarm: (alarm: Alarm) => void;
  onOpenComponent: (label: string) => void;
};

/** Below lg, the Overview tab under the scene: the active warning, the systems, the components. */
export function MobileOverview({ onOpenAlarm, onOpenComponent }: Props) {
  const snapshot = useLiveData();
  const history = useLiveHistory();
  if (!snapshot) return null;

  const activeAlarms = getActiveAlarms(snapshot);
  const first = activeAlarms[0];
  const warning = systemsInWarning(activeAlarms);
  const firstSensor = first?.sensorId ? findSensor(first.sensorId) : undefined;
  const firstReading = firstSensor ? snapshot.sensors[firstSensor.id] : undefined;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-6 lg:hidden">
      {first && (
        <button
          type="button"
          onClick={() => onOpenAlarm(first)}
          className="flex cursor-pointer items-center gap-4 rounded-2xl border border-warn-line bg-warn-soft px-4 py-3.5 text-left"
        >
          <TriangleAlert className="size-7 shrink-0 text-warn" aria-hidden />
          <span className="flex min-w-0 grow flex-col">
            <span className="text-base font-bold text-warn-ink">
              {first.title}
              {firstReading !== undefined && ` ${firstReading.toFixed(0)}${firstSensor?.unit}`}
            </span>
            <span className="text-sm text-ink-2">{first.componentLabel} · warning · tap to review</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink-2" aria-hidden />
        </button>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_LABEL_CLASS}>SYSTEMS</h2>
        <div className="grid grid-cols-2 gap-3">
          {OVERVIEW_SYSTEMS.map((card) => {
            const isWarning = warning.has(card.id);
            const isHull = card.id === "hull";
            const value = isHull ? (snapshot.sensors[HULL_STRESS_SENSOR] ?? 0) : card.value(snapshot);
            return (
              <div
                key={card.id}
                className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-3.5", isWarning ? "border-warn-line" : "border-line")}
              >
                <div className="flex items-center gap-1.5 text-sm">
                  <span className={cn("size-2 rounded-full", card.dotClass)} aria-hidden />
                  <span className="grow truncate font-semibold">{isHull ? "Hull" : card.title}</span>
                  {isWarning && <span className="text-[11px] font-bold text-warn">WARN</span>}
                </div>
                <span className="flex items-baseline gap-1">
                  <span className={cn("font-mono text-[26px] leading-none font-semibold", isWarning && "text-warn")}>
                    {isHull ? `${value.toFixed(0)}%` : card.format(value)}
                  </span>
                  <span className="text-xs text-muted">{isHull ? "stress" : card.unit}</span>
                </span>
                <Sparkline
                  values={history.map((entry) => (isHull ? (entry.sensors[HULL_STRESS_SENSOR] ?? 0) : card.value(entry)))}
                  strokeClass={isWarning ? "stroke-warn" : card.strokeClass}
                  className="h-8 w-full"
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={SECTION_LABEL_CLASS}>COMPONENTS</h2>
        <ul className="flex flex-col">
          {OVERVIEW_COMPONENTS.map(({ label, dotClass }) => {
            const hasAlarm = activeAlarms.some((alarm) => alarm.componentLabel === label);
            const reading = componentReading(label, snapshot, hasAlarm);
            return (
              <li key={label} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => onOpenComponent(label)}
                  className="flex w-full cursor-pointer items-center gap-3 py-3.5 text-left"
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", dotClass)} aria-hidden />
                  <span className="grow text-base font-semibold">{label}</span>
                  {reading && (
                    <span className={cn("text-sm", reading.tone === "warn" ? "font-semibold text-warn" : "font-mono text-ink-2")}>
                      {reading.text}
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
