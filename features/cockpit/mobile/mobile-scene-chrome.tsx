"use client";

import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { activeAlarmOn, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatBearing, formatElapsed, formatKnots } from "@/features/live-data/lib/format-readings";

const CHIP_CLASS = "rounded-lg bg-glass px-2.5 py-1.5 font-mono text-[13px] font-semibold text-ink backdrop-blur";
const BUTTON_CLASS =
  "pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-xl border border-glass-line bg-glass text-ink backdrop-blur";

type CardProps = {
  isExpanded: boolean;
  onToggleExpanded: () => void;
};

/** Below lg, on the scene's card: the ship's speed, heading and roll, and the way to a full-screen view. */
export function MobileSceneCardChrome({ isExpanded, onToggleExpanded }: CardProps) {
  const snapshot = useLiveData();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 lg:hidden">
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={isExpanded ? "Back to the overview" : "Show the ship full screen"}
        className={`${BUTTON_CLASS} absolute top-3 right-3`}
      >
        {isExpanded ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
      </button>
      {snapshot && !isExpanded && (
        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className={CHIP_CLASS}>{formatKnots(snapshot.navigation.speedOverGroundKn)}</span>
          <span className={CHIP_CLASS}>HDG {formatBearing(snapshot.navigation.headingDeg)}</span>
          <span className={CHIP_CLASS}>roll {snapshot.systems.hull.rollDeg.toFixed(1)}°</span>
        </div>
      )}
    </div>
  );
}

type SelectionProps = {
  componentLabel: string;
  /** Whether the component's alarm is the sheet's focus: then its state and time instead of the ship's way. */
  isShowingAlarm: boolean;
  onBack: () => void;
};

/** Below lg, over the scene with a component open: the way back, and the ship's way or the alarm's state. */
export function MobileSelectionChrome({ componentLabel, isShowingAlarm, onBack }: SelectionProps) {
  const snapshot = useLiveData();
  const alarm = activeAlarmOn(snapshot, componentLabel);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 lg:hidden">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className={BUTTON_CLASS}>
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        {isShowingAlarm && alarm && snapshot && (
          <span className="rounded-xl bg-alarm-badge px-3.5 py-2.5 text-sm font-bold tracking-[0.06em] text-alarm-badge-ink">
            {alarm.severity === "alarm" ? "ALARM" : "WARNING"} · {formatElapsed(alarm.raisedAt, snapshot.timestamp)}
          </span>
        )}
      </div>
      {!isShowingAlarm && snapshot && (
        <span className={CHIP_CLASS}>
          {formatKnots(snapshot.navigation.speedOverGroundKn)} · {formatBearing(snapshot.navigation.headingDeg)}
        </span>
      )}
    </div>
  );
}
