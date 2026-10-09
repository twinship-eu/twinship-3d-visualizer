"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { openAnomaly } from "@/features/anomalies/lib/anomaly-store";
import { getAlarmBadges, subscribeToBadgePositions, subscribeToBadges, type AlarmBadge } from "./alarm-badge-anchors";

const NO_BADGES: AlarmBadge[] = [];
const getServerBadges = () => NO_BADGES;

/** The badge's colours: the glow's — the design's warning amber and alarm red. */
const BADGE_CLASSES: Record<AlarmBadge["state"], string> = {
  warning: "bg-warn text-alarm-badge-ink shadow-[0_0_14px_var(--color-warn)]",
  alarm: "bg-alarm text-white shadow-[0_0_14px_var(--color-alarm)]",
  anomaly: "bg-anomaly text-black shadow-[0_0_18px_var(--color-anomaly)] animate-pulse",
};
const BADGE_NAMES: Record<AlarmBadge["state"], string> = { warning: "warning", alarm: "alarm", anomaly: "behaviour anomaly" };

/** How far above the part's top the badge sits, in CSS pixels. */
const BADGE_LIFT_PX = 10;

type Props = {
  /** Opens a component, by its label: the badge's action. */
  onOpenComponent: (label: string) => void;
};

/**
 * Over the scene, in Live data: a "!" above each part glowing for an alarm,
 * so it is plain why it glows. Follows the part every frame, outside React
 * (`ComponentAlarmGlow` places them); opens the part.
 */
export function AlarmBadges({ onOpenComponent }: Props) {
  const badges = useSyncExternalStore(subscribeToBadges, getAlarmBadges, getServerBadges);
  const badgeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(
    () =>
      subscribeToBadgePositions(() => {
        getAlarmBadges().forEach((badge, index) => {
          const element = badgeRefs.current[index];
          if (!element) return;
          element.style.visibility = badge.isVisible ? "visible" : "hidden";
          element.style.transform = `translate(${badge.x}px, ${badge.y - BADGE_LIFT_PX}px) translate(-50%, -100%)`;
        });
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {badges.map((badge, index) => (
        <button
          key={badge.componentLabel}
          ref={(element) => {
            badgeRefs.current[index] = element;
          }}
          type="button"
          onClick={() => (badge.alarmId ? openAnomaly(badge.alarmId) : onOpenComponent(badge.componentLabel))}
          aria-label={`${badge.componentLabel}: ${BADGE_NAMES[badge.state]} — open`}
          title={`${badge.componentLabel} · ${BADGE_NAMES[badge.state]}`}
          style={{ visibility: "hidden" }}
          className={cn(
            "pointer-events-auto absolute top-0 left-0 flex size-7 cursor-pointer items-center justify-center rounded-full text-base leading-none font-black",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            BADGE_CLASSES[badge.state]
          )}
        >
          !
        </button>
      ))}
    </div>
  );
}
