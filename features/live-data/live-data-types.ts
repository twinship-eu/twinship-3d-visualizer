/**
 * What the ship reports, as the cockpit reads it: one snapshot at a time.
 *
 * Shaped from the cockpit design's screens, before the real stream's format
 * is known. When it is, a source maps it onto these types (see
 * `LiveDataSource`) and the UI stays as it is.
 */

/** A position on the earth, in decimal degrees: north and east positive. */
export type GeoPosition = {
  latitude: number;
  longitude: number;
};

/** Where the ship is going and how fast. */
export type NavigationState = {
  /** Heading, degrees true, 0-360. */
  headingDeg: number;
  /** Course over ground, degrees true. */
  courseOverGroundDeg: number;
  /** Speed over ground, knots. */
  speedOverGroundKn: number;
  /** Speed through the water, knots. */
  speedThroughWaterKn: number;
  /** Rate of turn, degrees per minute, starboard positive. */
  rateOfTurnDegPerMin: number;
  /** The true wind: its speed in knots, and the bearing it blows from, degrees true. */
  trueWind: { speedKn: number; fromDeg: number };
  /** Null until a fix is received. */
  position: GeoPosition | null;
};

/** How serious an alarm or event is, from most to least. */
export type AlarmSeverity = "alarm" | "warning" | "info" | "resolved";

/** An alarm, a warning or a logged event, raised by a component. */
export type Alarm = {
  id: string;
  /** The component it concerns, by its label in the ontology tree (e.g. "Base Hull"). */
  componentLabel: string;
  title: string;
  /** What the reading is and where, in a line. */
  detail: string;
  severity: AlarmSeverity;
  /** When it was raised, ms since the epoch. */
  raisedAt: number;
  isAcknowledged: boolean;
};

/** The readings of each of the ship's systems. */
export type ShipSystems = {
  propulsion: {
    /** Propeller shaft speed, rpm. */
    shaftRpm: number;
    /** Shaft power, MW. */
    powerMw: number;
    /** Controllable pitch, % of full. */
    pitchPct: number;
  };
  energy: {
    /** Fuel burnt, tonnes per hour. */
    fuelTph: number;
    /** Main engine load, % of rated. */
    engineLoadPct: number;
    engineRpm: number;
    exhaustTempC: number;
    coolantTempC: number;
    /** Battery bank charge, %. */
    batteryPct: number;
  };
  windAssist: {
    /** Thrust from the rotor sails, kN. */
    thrustKn: number;
    /** Fuel saved against sailing without them, %. */
    fuelSavingPct: number;
    /** Each rotor's speed, rpm. */
    rotorRpm: [number, number];
  };
  hull: {
    /** Roll and pitch, degrees: starboard down and bow up positive. */
    rollDeg: number;
    pitchDeg: number;
    /** Mean draught, m. */
    meanDraftM: number;
  };
  deck: {
    /** Reefer container temperature, °C. */
    reeferTempC: number;
    /** The crane's state, as it reports it: "Stowed", "Working"… */
    craneState: string;
    craneHydraulicBar: number;
  };
  bridge: {
    vhfChannel: number;
    radar: string;
    ais: string;
  };
};

/** Where the snapshot comes from: the simulation, or the ship's own stream. */
export type LiveDataOrigin = "simulated" | "stream";

/** Everything the ship reports at one moment. */
export type LiveSnapshot = {
  /** When it was taken, ms since the epoch. */
  timestamp: number;
  origin: LiveDataOrigin;
  /** Snapshots per second the source sends. */
  rateHz: number;
  /** The level of autonomy the ship sails at, e.g. "L3". */
  autonomyLevel: string;
  navigation: NavigationState;
  systems: ShipSystems;
  /** Active alarms first, then the logged events, newest first within each. */
  alarms: Alarm[];
  /** Sensors fitted per component, by the component's label. */
  sensorCounts: Record<string, number>;
};

/**
 * Where snapshots come from. `start` begins sending them to `onSnapshot` and
 * returns what stops it.
 */
export type LiveDataSource = {
  origin: LiveDataOrigin;
  rateHz: number;
  start: (onSnapshot: (snapshot: LiveSnapshot) => void) => () => void;
};
