import type { Alarm } from "./live-data-types";

const MINUTE_MS = 60_000;

/**
 * The simulated alarm log: the cockpit design's sample alarms and events,
 * raised this long before the simulation starts.
 */
const MOCK_ALARMS: (Omit<Alarm, "raisedAt"> & { minutesAgo: number })[] = [
  {
    id: "hull-bending-stress",
    componentLabel: "Base Hull",
    title: "Hull bending stress high",
    detail: "Base Hull · frame 112 · 89% of allowable",
    severity: "warning",
    minutesAgo: 2,
    isAcknowledged: false,
  },
  {
    id: "exhaust-temp-cyl-4",
    componentLabel: "Engine",
    title: "Exhaust temp high · Cyl 4",
    detail: "Engine · > 400 °C for 3 min",
    severity: "warning",
    minutesAgo: 6,
    isAcknowledged: true,
  },
  {
    id: "rotor-sails-auto-trim",
    componentLabel: "WAPS",
    title: "Rotor sails auto-trim",
    detail: "WAPS · wind shifted to 040°",
    severity: "info",
    minutesAgo: 11,
    isAcknowledged: true,
  },
  {
    id: "crane-stowed",
    componentLabel: "Crane",
    title: "Crane stowed & locked",
    detail: "Deck equipment",
    severity: "resolved",
    minutesAgo: 27,
    isAcknowledged: true,
  },
];

/** The sample alarms, as if raised before `now`. */
export function createMockAlarms(now: number): Alarm[] {
  return MOCK_ALARMS.map(({ minutesAgo, ...alarm }) => ({
    ...alarm,
    raisedAt: now - minutesAgo * MINUTE_MS,
  }));
}
