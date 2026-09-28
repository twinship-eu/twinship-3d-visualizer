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

/** Where the simulated voyage starts: the North Sea, off Denmark. */
export const SIMULATION_START_POSITION = { latitude: 56.12, longitude: 7.45 } as const;

/** Share of the way back to the baseline a value moves each tick: a slow, bounded drift. */
export const SIMULATION_PULL = 0.15;

export const SIMULATED_AUTONOMY_LEVEL = "L3";

/** Sensors fitted per component, by label: sample counts. */
export const SIMULATED_SENSOR_COUNTS: Record<string, number> = {
  "Base Hull": 5,
  Engine: 5,
  Propellers: 3,
  WAPS: 4,
  Container: 2,
  Crane: 2,
};

/** Metres in a nautical mile, and seconds in an hour: for moving the simulated ship. */
export const METRES_PER_NAUTICAL_MILE = 1852;
export const SECONDS_PER_HOUR = 3600;
/** Metres in a degree of latitude, near enough. */
export const METRES_PER_DEGREE_LATITUDE = 111_320;
