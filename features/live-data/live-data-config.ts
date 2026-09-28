/**
 * The simulated ship: sample values from the cockpit design, drifting a
 * little every second, until the real stream is connected.
 */

/** Snapshots per second: the design's 1 Hz. */
export const SIMULATION_RATE_HZ = 1;

/** Where the simulated values sit, and how far each wanders from it. */
export const SIMULATION_BASELINE = {
  headingDeg: { value: 87, spread: 1.2 },
  courseOffsetDeg: { value: 2, spread: 0.8 },
  speedOverGroundKn: { value: 11.4, spread: 0.25 },
  speedThroughWaterKn: { value: 12.0, spread: 0.2 },
  rateOfTurnDegPerMin: { value: 0.2, spread: 0.3 },
  trueWindSpeedKn: { value: 17.6, spread: 0.8 },
  trueWindFromDeg: { value: 40, spread: 3 },
} as const;

/** The systems' simulated readings: value and spread, as for the navigation. */
export const SIMULATION_SYSTEMS_BASELINE = {
  shaftRpm: { value: 119, spread: 2 },
  shaftPowerMw: { value: 4.12, spread: 0.05 },
  pitchPct: { value: 73, spread: 0.6 },
  fuelTph: { value: 1.42, spread: 0.03 },
  engineLoadPct: { value: 67, spread: 1.5 },
  engineRpm: { value: 615, spread: 4 },
  exhaustTempC: { value: 397, spread: 3 },
  coolantTempC: { value: 78, spread: 0.6 },
  batteryPct: { value: 81, spread: 0.2 },
  windThrustKn: { value: 37, spread: 1.2 },
  fuelSavingPct: { value: 14, spread: 0.4 },
  rotorRpm: { value: 210, spread: 3 },
  rollDeg: { value: -0.8, spread: 1.2 },
  pitchDeg: { value: 0.3, spread: 0.3 },
  draftForeM: { value: 7.37, spread: 0.02 },
  draftAftM: { value: 7.49, spread: 0.02 },
  slammingPerHour: { value: 2.2, spread: 0.1 },
  ballastPct: { value: 48, spread: 0.1 },
  reeferTempC: { value: 4.1, spread: 0.1 },
  craneHydraulicBar: { value: 179, spread: 0.8 },
} as const;
export const SIMULATED_CRANE_STATE = "Stowed";
/** The sea's significant wave height, m: head seas, as in the design's alarm. */
export const SIMULATED_WAVE_HEIGHT = { value: 3.0, spread: 0.08 } as const;
export const SIMULATED_BRIDGE = { vhfChannel: 16, radar: "Active", ais: "TX" } as const;

/** Snapshots kept for the trends: a minute at 1 Hz. */
export const LIVE_HISTORY_LENGTH = 60;

/** Where the simulated voyage starts: the North Sea, off Denmark. */
export const SIMULATION_START_POSITION = { latitude: 56.12, longitude: 7.45 } as const;

/** Share of the way back to the baseline a value moves each tick: a slow, bounded drift. */
export const SIMULATION_PULL = 0.15;

export const SIMULATED_AUTONOMY_LEVEL = "L3";

/** Metres in a nautical mile, and seconds in an hour: for moving the simulated ship. */
export const METRES_PER_NAUTICAL_MILE = 1852;
export const SECONDS_PER_HOUR = 3600;
/** Metres in a degree of latitude, near enough. */
export const METRES_PER_DEGREE_LATITUDE = 111_320;
