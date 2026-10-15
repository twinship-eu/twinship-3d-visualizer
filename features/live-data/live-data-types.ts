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
  /** Rudder angle, degrees, starboard positive. */
  rudderDeg: number;
  /** Drift angle, degrees: between heading and course over ground. */
  driftDeg: number;
  /** Cross-track error, nautical miles, off the planned route. */
  crossTrackErrorNm: number;
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
  /** The sensor whose reading raised it, by id (see the sensor catalogue). */
  sensorId?: string;
  /** What most likely caused it, in a sentence. */
  likelyCause?: string;
  /** What the ship's decision support proposes, with the reading each is predicted to bring. */
  recommendedActions?: { title: string; prediction: string }[];
  /** Other sensors to watch with it, by id. */
  relatedSensorIds?: string[];
  /** When it cleared — its reading back within limits — ms since the epoch; absent while it lasts. */
  clearedAt?: number;
  /**
   * What raised it: a sensor past its limit ("limit", the default), or a
   * behaviour the ship's model does not expect while every sensor is inside
   * its limits ("behaviour") — see `anomaly`.
   */
  kind?: AlarmKind;
  /** How much of the ship it concerns: one component (the default), a group that works together, or the whole ship. */
  scope?: AlarmScope;
  /** A behaviour anomaly's own account: what is off, and where. */
  anomaly?: BehaviourAnomaly;
};

export type AlarmKind = "limit" | "behaviour";
export type AlarmScope = "component" | "group" | "ship";

/** A reading as the ship's model expects it, and as it is. */
export type ModelComparison = { label: string; model: string; actual: string };
/** A share of an anomaly, and which way: what drives it, or a group that contributes. */
export type AnomalyShare = { label: string; note: string; share: number };
/** A likely cause, by pattern match, and how likely. */
export type AnomalyCause = { title: string; detail: string; share: number };

/**
 * A behaviour anomaly: every sensor inside its limits, but together they do
 * not fit the model — in a group of components that work together (it may
 * span ontology systems), or in the ship as a whole.
 */
export type BehaviourAnomaly = {
  /** The group's name ("Propulsion chain") or the vessel's. */
  name: string;
  /** The components involved, by their labels in the tree; in a chain, in its order. */
  members: string[];
  /** Whether the members form a chain, drawn linked on the ship (engine → shaft → propellers). */
  isChain: boolean;
  /** The ontology systems involved, by their section ids (the tree tags them). */
  systemIds: string[];
  /** The banner's line: what is off. */
  summary: string;
  /** Why it is flagged on the group or the ship, in a sentence or two. */
  why: string;
  /** The anomaly score now, 0 to 1, and from which it is raised. */
  score: number;
  threshold: number;
  /** Now against the model: the balance it is judged on. */
  comparisons: ModelComparison[];
  /** A line under the comparisons. */
  comparisonNote: string;
  /** What drives it (a group), or the groups that contribute (the whole ship), each a share. */
  shares: AnomalyShare[];
  causes: AnomalyCause[];
  nextSteps: string[];
};

/** What the operator did about an alarm from the cockpit, and when (ms since the epoch). */
export type OperatorAction =
  | { kind: "acknowledged"; alarmId: string; at: number }
  | { kind: "silenced"; alarmId: string; at: number; until: number };

/** The readings of each of the ship's systems. */
export type ShipSystems = {
  propulsion: {
    /** Propeller shaft speed, rpm. */
    shaftRpm: number;
    /** Shaft power, MW. */
    powerMw: number;
    /** Controllable pitch, % of full. */
    pitchPct: number;
    /** Propeller slip, %. */
    slipPct: number;
  };
  energy: {
    /** Fuel burnt, tonnes per hour. */
    fuelTph: number;
    /** The gensets' load, % of rated (both, averaged), and their speed, rpm. */
    engineLoadPct: number;
    engineRpm: number;
    exhaustTempC: number;
    coolantTempC: number;
    /** Battery bank charge, %. */
    batteryPct: number;
  };
  windAssist: {
    /** Thrust from the suction sails, kN. */
    thrustKn: number;
    /** Fuel saved against sailing without them, %. */
    fuelSavingPct: number;
    /** Each suction sail's fan speed, rpm. */
    fanRpm: [number, number];
  };
  hull: {
    /** Roll and pitch, degrees: starboard down and bow up positive. */
    rollDeg: number;
    pitchDeg: number;
    /** Mean draught, m, and at the bow and the stern. */
    meanDraftM: number;
    draftForeM: number;
    draftAftM: number;
    /** Trim, m: by the stern positive. */
    trimM: number;
    /** Slamming events, per hour. */
    slammingPerHour: number;
    /** Ballast tanks filled, %. */
    ballastPct: number;
    /** Heave amplitude, m, and the period of the ship's roll, s. */
    heaveM: number;
    rollPeriodS: number;
  };
  deck: {
    /** The truck's reefer trailer temperature, °C. */
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

/** A point of the planned route: its name, and how far along the route it is. */
export type Waypoint = { name: string; atNm: number };

/** The voyage: where from and to, how far along, and the route's waypoints. */
export type VoyageState = {
  origin: string;
  destination: string;
  /** The route's length, and how much of it is left, nautical miles. */
  totalNm: number;
  distanceToGoNm: number;
  waypoints: Waypoint[];
  /** The ship's economical and design speeds, knots. */
  ecoSpeedKn: number;
  designSpeedKn: number;
};

/** Where the snapshot comes from: the simulation, a recording of the ship played back, or the ship's own stream. */
export type LiveDataOrigin = "simulated" | "recorded" | "stream";

/** Everything the ship reports at one moment. */
export type LiveSnapshot = {
  /** When it was taken, ms since the epoch. */
  timestamp: number;
  /**
   * The moment the readings are of, ms since the epoch: the data's own clock.
   * The viewer's for a ship's stream and the simulation; a recording's, as it
   * was taken, when one is played — the sun in the sky follows it.
   */
  observedAt: number;
  origin: LiveDataOrigin;
  /** Snapshots per second the source sends. */
  rateHz: number;
  /** The level of autonomy the ship sails at, e.g. "L3". */
  autonomyLevel: string;
  navigation: NavigationState;
  systems: ShipSystems;
  voyage: VoyageState;
  /** The sea round the ship. */
  /**
   * The sea's significant wave height, m: the data's when it reports one
   * (`isWaveHeightRecorded`), which the scene's sea is then raised to; else
   * the height of the sea the scene raised from the wind.
   */
  sea: { significantWaveHeightM: number; isWaveHeightRecorded?: boolean };
  /** Every sensor's latest reading, by its id (see the sensor catalogue). */
  sensors: Record<string, number>;
  /** Active alarms first, then the logged events, newest first within each. */
  alarms: Alarm[];
  /** Sensors fitted per component, by the component's label. */
  sensorCounts: Record<string, number>;
};

/** A limit of a recorded reading: from `value` up ("high"), or from it down ("low"). */
export type RecordingLimit = { value: number; direction: "high" | "low" };

/** A column of a recording: `<COMPONENT-ID>.<PARAMETER>`, its component in the knowledge graph, its limits. */
export type RecordingColumn = {
  name: string;
  component: string;
  parameter: string;
  warning: RecordingLimit | null;
  alarm: RecordingLimit | null;
};

/**
 * A stretch of the ship's readings, recorded, as `scripts/convert-timeseries.py`
 * writes it from the time-series workbook: column by column.
 */
export type Recording = {
  /** The workbook it was converted from. */
  source: string;
  columns: RecordingColumn[];
  /** Each row's moment, ms since the epoch, increasing. */
  times: number[];
  /** Each column's readings, one per row: null for no reading. */
  values: Record<string, (number | string | null)[]>;
};

/**
 * Where snapshots come from. `start` begins sending them to `onSnapshot` and
 * returns what stops it.
 */
export type LiveDataSource = {
  origin: LiveDataOrigin;
  rateHz: number;
  /** `onHistory`, when the source has a past (a recording), gets it once, oldest first, before the first snapshot. */
  start: (onSnapshot: (snapshot: LiveSnapshot) => void, onHistory?: (snapshots: LiveSnapshot[]) => void) => () => void;
  /** Tells the ship an alarm has been seen: it stays in the log, no longer active. */
  acknowledgeAlarm: (alarmId: string) => void;
  /** Whether the live data is being looked at: a source that asks a server for it asks only then. */
  setIsViewed?: (isViewed: boolean) => void;
};
