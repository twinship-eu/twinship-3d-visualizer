import type { Alarm, LiveSnapshot } from "@/features/live-data/live-data-types";

/** The ship's systems, as Live data groups them. */
export type SystemId = "propulsion" | "energy" | "windAssist" | "hull" | "deck";

/** Which system each component, by its label in the ontology tree, belongs to. */
export const COMPONENT_SYSTEMS: Record<string, SystemId> = {
  "Base Hull": "hull",
  "Hull top towers": "hull",
  "Control room": "hull",
  Radio: "hull",
  Engine: "energy",
  Propellers: "propulsion",
  WAPS: "windAssist",
  Container: "deck",
  Crane: "deck",
};

/** Each component's object in the ship's GLB, by its label in the ontology tree. */
export const COMPONENT_OBJECT_NAMES: Record<string, string> = {
  "Base Hull": "Base",
  "Hull top towers": "Base_Top",
  "Control room": "ControlRoom",
  Radio: "Radio",
  Container: "Container",
  Crane: "Crane",
  Propellers: "Propellers",
  Engine: "Engine",
  WAPS: "WindTurbines",
};

/** A system's state: warning while one of its components has an active warning. */
export type SystemStatus = "normal" | "warning";

/** The systems with an active, unacknowledged warning or alarm. */
export function systemsInWarning(activeAlarms: Alarm[]): Set<string> {
  return new Set(
    activeAlarms.map((alarm) => COMPONENT_SYSTEMS[alarm.componentLabel]).filter((system): system is SystemId => !!system)
  );
}

/** A reading under a system card's main value: its label and value. */
type CardReading = { label: string; value: (snapshot: LiveSnapshot) => string };

/** One of the system cards under the scene: its main value, trend and two readings. */
export type SystemCard = {
  /** A system's id, for its warning state; any unique id for cards with no status. */
  id: string;
  title: string;
  /** The Tailwind classes for its dot and trend: its section's colour. */
  dotClass: string;
  strokeClass: string;
  value: (snapshot: LiveSnapshot) => number;
  format: (value: number) => string;
  unit: string;
  /** Shown instead of the main value when the reading has no meaning now (the ship stopped…). */
  isAvailable?: (snapshot: LiveSnapshot) => boolean;
  readings: [CardReading, CardReading];
};

const fixed = (digits: number) => (value: number) => value.toFixed(digits);

/** The five cards, left to right, as the design lays them out. */
export const SYSTEM_CARDS: SystemCard[] = [
  {
    id: "propulsion",
    title: "Propulsion",
    dotClass: "bg-system-propeller",
    strokeClass: "stroke-system-propeller",
    value: (snapshot) => snapshot.systems.propulsion.shaftRpm,
    format: fixed(0),
    unit: "rpm",
    readings: [
      { label: "Power", value: (snapshot) => `${snapshot.systems.propulsion.powerMw.toFixed(2)} MW` },
      { label: "Pitch", value: (snapshot) => `${snapshot.systems.propulsion.pitchPct.toFixed(0)}%` },
    ],
  },
  {
    id: "energy",
    title: "Energy",
    dotClass: "bg-system-energy",
    strokeClass: "stroke-system-energy",
    value: (snapshot) => snapshot.systems.energy.fuelTph,
    format: fixed(2),
    unit: "t/h",
    readings: [
      { label: "Load", value: (snapshot) => `${snapshot.systems.energy.engineLoadPct.toFixed(0)}%` },
      { label: "Battery", value: (snapshot) => `${snapshot.systems.energy.batteryPct.toFixed(0)}%` },
    ],
  },
  {
    id: "windAssist",
    title: "Wind assist",
    dotClass: "bg-system-hull",
    strokeClass: "stroke-system-hull",
    value: (snapshot) => snapshot.systems.windAssist.thrustKn,
    format: fixed(0),
    unit: "kN",
    readings: [
      { label: "Saving", value: (snapshot) => `${snapshot.systems.windAssist.fuelSavingPct.toFixed(0)}%` },
      { label: "Wind", value: (snapshot) => `${snapshot.navigation.trueWind.speedKn.toFixed(1)} kn` },
    ],
  },
  {
    id: "hull",
    title: "Hull & stability",
    dotClass: "bg-system-hull",
    strokeClass: "stroke-system-hull",
    value: (snapshot) => snapshot.systems.hull.rollDeg,
    format: (value) => `${value.toFixed(1)}°`,
    unit: "roll",
    readings: [
      { label: "Pitch", value: (snapshot) => `${snapshot.systems.hull.pitchDeg.toFixed(1)}°` },
      { label: "Draft", value: (snapshot) => `${snapshot.systems.hull.meanDraftM.toFixed(2)} m` },
    ],
  },
  {
    id: "deck",
    title: "Deck equipment",
    dotClass: "bg-system-deck",
    strokeClass: "stroke-system-deck",
    value: (snapshot) => snapshot.systems.deck.reeferTempC,
    format: fixed(1),
    unit: "°C reefer",
    readings: [
      { label: "Crane", value: (snapshot) => snapshot.systems.deck.craneState },
      { label: "Hyd", value: (snapshot) => `${snapshot.systems.deck.craneHydraulicBar.toFixed(0)} bar` },
    ],
  },
];
