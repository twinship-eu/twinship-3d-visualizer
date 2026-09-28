"use client";

import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import type { Alarm } from "@/features/live-data/live-data-types";
import { AlarmsEventsList } from "../components/alarms-events-list";
import { RouteProgress } from "../voyage/route-progress";
import { AttitudeCard, MotionCard, RelativeWindCard } from "../voyage/voyage-instruments";
import { VoyageSummary } from "../voyage/voyage-summary";

/**
 * Below lg, the Voyage tab under the scene: the instruments the desktop lays
 * over the scene, stacked full width.
 */
export function MobileVoyage() {
  const snapshot = useLiveData();
  if (!snapshot) return null;

  return (
    // The instruments are sized for the desktop's corners: full width here
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6 lg:hidden [&_section]:w-full">
      <MotionCard snapshot={snapshot} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AttitudeCard snapshot={snapshot} />
        <RelativeWindCard snapshot={snapshot} />
      </div>
      <RouteProgress snapshot={snapshot} />
      <div className="-mx-3.5">
        <VoyageSummary />
      </div>
    </div>
  );
}

/** Below lg, the Alarms tab under the scene: the whole log, each opening its component. */
export function MobileAlarms({ onOpen }: { onOpen: (alarm: Alarm) => void }) {
  return (
    <div className="lg:hidden [&_section]:max-h-none [&_section]:border-t-0">
      <AlarmsEventsList onOpen={onOpen} />
    </div>
  );
}
