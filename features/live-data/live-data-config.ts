/**
 * The simulated ship: sample values from the cockpit design, drifting a
 * little every second, until the real stream is connected.
 */

/** Snapshots per second: the design's 1 Hz. */
export const SIMULATION_RATE_HZ = 1;

/** Where the simulated values sit, and how far each wanders from it: at about the design speed, as the sample recording. */
export const SIMULATION_BASELINE = {
  headingDeg: { value: 87, spread: 1.2 },
  courseOffsetDeg: { value: 2, spread: 0.8 },
  speedOverGroundKn: { value: 18.0, spread: 0.25 },
  speedThroughWaterKn: { value: 18.6, spread: 0.2 },
  rateOfTurnDegPerMin: { value: 0.2, spread: 0.3 },
  trueWindSpeedKn: { value: 17.6, spread: 0.8 },
  trueWindFromDeg: { value: 40, spread: 3 },
  rudderDeg: { value: 1.1, spread: 0.6 },
  crossTrackErrorNm: { value: 0.04, spread: 0.01 },
} as const;

/** The simulated voyage: placeholder names as in the design, 62% along its route. */
export const SIMULATED_VOYAGE = {
  origin: "[ORIGIN]",
  destination: "[DESTINATION]",
  totalNm: 484,
  distanceToGoNm: 184,
  waypoints: [
    { name: "[WP 1]", atNm: 160 },
    { name: "[WP NAME]", atNm: 316 },
    { name: "[WP 3]", atNm: 420 },
  ],
  ecoSpeedKn: 9,
  designSpeedKn: 18,
} as const;

/** The systems' simulated readings: value and spread, as for the navigation. */
export const SIMULATION_SYSTEMS_BASELINE = {
  shaftRpm: { value: 140, spread: 2 },
  shaftPowerMw: { value: 9.6, spread: 0.1 },
  pitchPct: { value: 96, spread: 0.4 },
  slipPct: { value: 6, spread: 0.3 },
  fuelTph: { value: 1.94, spread: 0.03 },
  engineLoadPct: { value: 82, spread: 1.5 },
  engineRpm: { value: 720, spread: 2 },
  exhaustTempC: { value: 397, spread: 3 },
  coolantTempC: { value: 78, spread: 0.6 },
  batteryPct: { value: 81, spread: 0.2 },
  windThrustKn: { value: 37, spread: 1.2 },
  fuelSavingPct: { value: 10, spread: 0.4 },
  // The suction sails' fans, as in the sample recording
  fanRpm: { value: 1480, spread: 15 },
  // (Roll, pitch and heave come from the scene: how the ship rides its waves)
  draftForeM: { value: 7.37, spread: 0.02 },
  draftAftM: { value: 7.49, spread: 0.02 },
  slammingPerHour: { value: 2.2, spread: 0.1 },
  ballastPct: { value: 48, spread: 0.1 },
  rollPeriodS: { value: 11.8, spread: 0.1 },
  reeferTempC: { value: 4.1, spread: 0.1 },
  craneHydraulicBar: { value: 179, spread: 0.8 },
} as const;
export const SIMULATED_CRANE_STATE = "Stowed";
/** The sea's significant wave height, m, until the scene has raised its own sea. */
export const SIMULATED_WAVE_HEIGHT = { value: 3.0, spread: 0.08 } as const;
export const SIMULATED_BRIDGE = { vhfChannel: 16, radar: "Active", ais: "TX" } as const;

/** Snapshots the trends show: a minute at 1 Hz. */
export const LIVE_HISTORY_LENGTH = 60;
/** How far back the timeline reaches, in minutes, and the snapshots that keeps at 1 Hz. */
export const PLAYBACK_WINDOW_MINUTES = 30;
export const PLAYBACK_HISTORY_LENGTH = PLAYBACK_WINDOW_MINUTES * 60 * SIMULATION_RATE_HZ;

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
