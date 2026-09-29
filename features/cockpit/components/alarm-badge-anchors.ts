import type { SensorState } from "@/features/live-data/live-data-sensors";

/** A part glowing for an alarm, and where its badge goes on screen: CSS pixels from the scene's top left. */
export type AlarmBadge = {
  componentLabel: string;
  state: Exclude<SensorState, "normal">;
  x: number;
  y: number;
  isVisible: boolean;
};

/**
 * The glowing parts' badges, as `ComponentAlarmGlow` last placed them. Which
 * parts is React's to render (`subscribeToBadges`, on a change); where, the
 * overlay reads every frame (`subscribeToBadgePositions`), outside React.
 */
let badges: AlarmBadge[] = [];
const listListeners = new Set<() => void>();
const positionListeners = new Set<() => void>();

function subscribe(listeners: Set<() => void>, listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getAlarmBadges = () => badges;
export const subscribeToBadges = (listener: () => void) => subscribe(listListeners, listener);
export const subscribeToBadgePositions = (listener: () => void) => subscribe(positionListeners, listener);

/** Which parts have a badge: a new list, off screen until first placed. */
export function setAlarmBadges(parts: Pick<AlarmBadge, "componentLabel" | "state">[]) {
  badges = parts.map((part) => ({ ...part, x: 0, y: 0, isVisible: false }));
  listListeners.forEach((listener) => listener());
}

/** Tells the overlay the badges are placed for this frame. */
export function publishBadgePositions() {
  positionListeners.forEach((listener) => listener());
}
