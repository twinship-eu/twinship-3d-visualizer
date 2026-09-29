/**
 * What the ship's data sets in the scene, when it gives it: the scene is
 * drawn from the data, not from its own defaults. Null for the scene's own
 * value. Written by `LiveSceneSync` (outside the Canvas), read every frame by
 * the sea and the ship — plain objects rather than React state: setting them
 * re-renders nothing.
 */
export const liveSceneOverrides: {
  /** The ship's speed when under way, knots. */
  shipSpeedKnots: number | null;
  /** The propeller shafts' speed when under way, rpm. */
  propellerRpm: number | null;
  /** The true wind: its speed, m/s, and the side it comes from, degrees off the bow, starboard positive. */
  wind: { speedMs: number; fromRelativeDeg: number } | null;
} = {
  shipSpeedKnots: null,
  propellerRpm: null,
  wind: null,
};

/**
 * What only the scene knows of the sea, for the simulated data to report
 * until the ship reports it: the sea state the wind raised. Written by the
 * sea every frame; null before it has drawn one.
 */
export const sceneSeaState: { significantWaveHeightM: number | null } = {
  significantWaveHeightM: null,
};
