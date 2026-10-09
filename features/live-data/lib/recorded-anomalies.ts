import type { Alarm, BehaviourAnomaly, LiveSnapshot, Recording } from "../live-data-types";
import type { PlaybackLoop } from "./recorded-alarms";

/**
 * The demo's behaviour anomalies, on the recording's timeline: every sensor
 * stays inside its limits, but the ship's model flags how they behave
 * together — a group of components, and the ship as a whole. Sample data, as
 * the design shows them; the score and the numbers move with the playback.
 */

const MS_PER_MINUTE = 60_000;
/** The score from which a behaviour is raised as an anomaly. */
const THRESHOLD = 0.7;

type Definition = {
  id: string;
  scope: "group" | "ship";
  title: string;
  componentLabel: string;
  detail: string;
  /** Minutes into the recording the score starts to rise, and how long it takes to reach its peak. */
  startMin: number;
  riseMin: number;
  /** The score at rest and at its peak. */
  baseScore: number;
  peakScore: number;
  /** The account, given the share of the rise reached (0 to 1) and the snapshot now. */
  describe: (progress: number, snapshot: LiveSnapshot) => Omit<BehaviourAnomaly, "score" | "threshold">;
};

const fixed = (value: number, digits: number) => value.toFixed(digits);

const DEFINITIONS: Definition[] = [
  {
    id: "anomaly:propulsion-chain",
    scope: "group",
    title: "Propulsion behaving abnormally",
    componentLabel: "Propellers",
    detail: "Group · Engine → Propellers",
    startMin: 3,
    riseMin: 6,
    baseScore: 0.42,
    peakScore: 0.84,
    describe: (progress, snapshot) => {
      const fuel = snapshot.systems.energy.fuelTph;
      const power = snapshot.systems.propulsion.powerMw;
      const speed = snapshot.navigation.speedThroughWaterKn;
      // More energy in, less speed out: the model's expectation is what a clean hull would need
      const excess = 0.09 * progress;
      return {
        name: "Propulsion chain",
        members: ["Engine", "Propellers"],
        isChain: true,
        systemIds: ["energy", "propeller"],
        summary: "Propulsion chain (engine → shaft → propellers) behaves unlike its model",
        why: "Each part on its own looks fine. Only together — fuel in, power out, speed achieved — do they disagree with the model.",
        comparisons: [
          { label: "Fuel in", model: `${fixed(fuel / (1 + excess), 2)} t/h`, actual: `${fixed(fuel, 2)} t/h` },
          { label: "Shaft power", model: `${fixed(power / (1 + excess * 0.7), 2)} MW`, actual: `${fixed(power, 2)} MW` },
          { label: "Speed through water", model: `${fixed(speed * (1 + excess * 0.4), 1)} kn`, actual: `${fixed(speed, 1)} kn` },
        ],
        comparisonNote: "More energy goes in, less speed comes out. Each part is inside its limits — it's the chain that is off.",
        shares: [
          { label: "Shaft power for this speed", note: "higher than model", share: 38 },
          { label: "Propeller slip", note: "higher than model", share: 27 },
          { label: "Speed through water", note: "lower than model", share: 21 },
          { label: "Engine load", note: "higher than model", share: 14 },
        ],
        causes: [
          { title: "Hull or propeller fouling", detail: "Slow rise over hours, slip up, engine healthy", share: 72 },
          { title: "Engine efficiency loss", detail: "Would also raise exhaust on all cylinders", share: 18 },
        ],
        nextSteps: ["Ask the assistant to explain", "Schedule hull & propeller inspection"],
      };
    },
  },
  {
    id: "anomaly:ship-stability",
    scope: "ship",
    title: "Ship motion unlike model",
    componentLabel: "Base Hull",
    detail: "Whole ship · 3 groups involved",
    // Before playback opens (17 min in): there to step to from the start, as the group's is
    startMin: 11,
    riseMin: 1.5,
    baseScore: 0.38,
    peakScore: 0.81,
    describe: (progress, snapshot) => {
      const roll = snapshot.systems.hull.rollDeg;
      return {
        name: "TwinShip VESSEL",
        members: ["Base Hull", "Truck with trailer", "WAPS"],
        isChain: false,
        systemIds: ["hull", "deck", "windAssisted"],
        summary: "The vessel rolls and leans unlike its stability model",
        why: "Stability comes from how cargo, ballast and hull add up — no single part owns it. 3 of 6 groups contribute.",
        comparisons: [
          { label: "Roll period", model: "12.2 s", actual: `${fixed(12.2 + 2.5 * progress, 1)} s` },
          { label: "Static list", model: "0.0°", actual: `${fixed(1.7 * progress + Math.abs(roll) * 0.05, 1)}° P` },
          { label: "Stability (GM)", model: "1.92 m", actual: `${fixed(1.92 - 0.51 * progress, 2)} m` },
        ],
        comparisonNote: "The ship rolls slower and leans to port — it acts less stable than its loading plan says.",
        shares: [
          { label: "Cargo", note: "cargo moved", share: 46 },
          { label: "Hull", note: "roll & list", share: 34 },
          { label: "Wind assist", note: "heel moment", share: 20 },
        ],
        causes: [
          { title: "Cargo shifted on deck", detail: "Load cells moved to port after the roll peak", share: 61 },
          { title: "Free surface in a ballast tank", detail: "Would lengthen roll period without a list", share: 27 },
        ],
        nextSteps: ["Ask the assistant to explain", "Check lashing, port side deck"],
      };
    },
  },
];

/** The score of a definition at a moment of the recording, and the share of its rise reached. */
function scoreAt(definition: Definition, minutes: number) {
  const progress = Math.min(Math.max((minutes - definition.startMin) / definition.riseMin, 0), 1);
  // Eased, with a small wander so the line is not ruled
  const eased = progress * progress * (3 - 2 * progress);
  const wander = 0.012 * Math.sin(minutes * 1.7 + definition.startMin);
  return { progress: eased, score: definition.baseScore + (definition.peakScore - definition.baseScore) * eased + wander };
}

/** Minutes into the recording at which a definition's score first reaches the threshold. */
function raisedAtMinutes(definition: Definition) {
  for (let minutes = definition.startMin; minutes <= definition.startMin + definition.riseMin; minutes += 1 / 60) {
    if (scoreAt(definition, minutes).score >= THRESHOLD) return minutes;
  }
  return null;
}

/**
 * The behaviour anomalies at a moment of the recording, on a snapshot: each
 * raised once its score has reached the threshold, with its account then.
 */
export function anomaliesAt(recording: Recording, moment: number, loop: PlaybackLoop, snapshot: LiveSnapshot): Alarm[] {
  const minutes = (moment - recording.times[0]) / MS_PER_MINUTE;
  return DEFINITIONS.flatMap((definition) => {
    const raisedMin = raisedAtMinutes(definition);
    if (raisedMin === null || minutes < raisedMin) return [];
    const { progress, score } = scoreAt(definition, minutes);
    const raisedAt = loop.toViewerTime(recording.times[0] + raisedMin * MS_PER_MINUTE);
    return [
      {
        id: `${definition.id}@${loop.index}`,
        kind: "behaviour" as const,
        scope: definition.scope,
        componentLabel: definition.componentLabel,
        title: definition.title,
        detail: definition.detail,
        severity: "warning" as const,
        raisedAt,
        isAcknowledged: false,
        anomaly: { ...definition.describe(progress, snapshot), score, threshold: THRESHOLD },
      },
    ];
  });
}
