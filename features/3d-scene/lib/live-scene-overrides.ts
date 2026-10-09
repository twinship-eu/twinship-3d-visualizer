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
  /**
   * The true wind: its speed, m/s, and the side it comes from, degrees off the
   * bow, starboard positive. `isUserSet` when the user chose it (in the
   * Ontology): the sea then takes it at once, every wave from that side,
   * rather than following the data's slowly. `significantWaveHeightM` when
   * the data reports the sea's height: the waves are raised to it, not to the
   * wind's fully developed sea.
   */
  wind: { speedMs: number; fromRelativeDeg: number; isUserSet?: boolean; significantWaveHeightM?: number | null } | null;
  /**
   * Where the sun is, from the data's place and clock: its height and its
   * compass bearing, and the ship's heading to turn it to the bow. Null for the
   * scene's own sun.
   */
  sun: { elevationDeg: number; azimuthDeg: number; headingDeg: number } | null;
  /**
   * The camera held to a compass bearing as the ship turns, rather than to
   * the ship: the bearing it looks towards, and the ship's heading its pose
   * was set for. Null: the camera stays with the ship (the Ontology).
   */
  compassCamera: { bearingDeg: number; headingDeg: number } | null;
} = {
  shipSpeedKnots: null,
  propellerRpm: null,
  wind: null,
  sun: null,
  compassCamera: null,
};

/**
 * What only the scene knows of the sea, for the simulated data to report
 * until the ship reports it: the sea state the wind raised. Written by the
 * sea every frame; null before it has drawn one.
 */
export const sceneSeaState: { significantWaveHeightM: number | null } = {
  significantWaveHeightM: null,
};
