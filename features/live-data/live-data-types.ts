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
    /** Propeller slip, %. */
    slipPct: number;
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
  origin: LiveDataOrigin;
  /** Snapshots per second the source sends. */
  rateHz: number;
  /** The level of autonomy the ship sails at, e.g. "L3". */
  autonomyLevel: string;
  navigation: NavigationState;
  systems: ShipSystems;
  voyage: VoyageState;
  /** The sea round the ship. */
  sea: { significantWaveHeightM: number };
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
  start: (onSnapshot: (snapshot: LiveSnapshot) => void) => () => void;
  /** Tells the ship an alarm has been seen: it stays in the log, no longer active. */
  acknowledgeAlarm: (alarmId: string) => void;
};
