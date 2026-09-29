import type { Alarm } from "./live-data-types";

const MINUTE_MS = 60_000;

/**
 * What the ship's decision support says of a sensor's alarm: its likely cause,
 * what to do, what to watch with it. By sensor id — the simulation's alarms
 * and those raised from a recording both read it.
 */
export const ALARM_ADVICE: Record<string, Pick<Alarm, "likelyCause" | "recommendedActions" | "relatedSensorIds">> = {
  "EX-4": {
    likelyCause: "Cylinder 4 running hotter than the others: its fuel injection or its cooling.",
    recommendedActions: [
      { title: "Reduce engine load to 60%", prediction: "Predicted exhaust ~385 °C · speed −0.6 kn" },
      { title: "Shift load to the battery", prediction: "Predicted exhaust ~390 °C · battery −6%/h" },
    ],
    relatedSensorIds: ["CW-1", "VB-1"],
  },
  "SG-03": {
    likelyCause: "Head seas while holding cruising speed.",
    relatedSensorIds: ["SG-04"],
  },
};

/**
 * The simulated alarm log: the cockpit design's sample alarms and events,
 * raised this long before the simulation starts. The active one is on the
 * engine, a part that stands out in the scene when it glows.
 */
const MOCK_ALARMS: (Omit<Alarm, "raisedAt"> & { minutesAgo: number })[] = [
  {
    id: "exhaust-temp-cyl-4",
    componentLabel: "Engine",
    title: "Exhaust temp high · Cyl 4",
    detail: "Engine · cylinder 4 over 400 °C",
    severity: "warning",
    minutesAgo: 2,
    isAcknowledged: false,
    sensorId: "EX-4",
    ...ALARM_ADVICE["EX-4"],
  },
  {
    // An earlier warning, acknowledged: its reading has since come back under the limit
    id: "hull-bending-stress",
    componentLabel: "Base Hull",
    title: "Hull bending stress high",
    detail: "Base Hull · frame 112 · over 80% of allowable",
    severity: "warning",
    minutesAgo: 9,
    isAcknowledged: true,
    sensorId: "SG-03",
    ...ALARM_ADVICE["SG-03"],
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
