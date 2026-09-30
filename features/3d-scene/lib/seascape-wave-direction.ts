/**
 * Where the sea's waves come from, round the ship — a choice, for the sense of
 * motion. Waves off the bow's side sweep across the ship's path as it sails,
 * and as fast as it sails; with nothing still in the water to hold the eye,
 * the ship seems to slide sideways. Head seas read as sailing.
 *
 * - `wind`: every wave from the side the data's wind comes from (the wind's
 *   own truth, the old way);
 * - `shortWaves`: the long, peak waves head-on, the short chop from the
 *   wind's side — what one sees most reads as sailing, the chop keeps the wind;
 * - `ahead`: every wave head-on.
 *
 * The apparent wind (the relative-wind panel, the flag, the rain) always
 * keeps the data's side: only the waves are turned.
 */
export const WAVES_FROM_OPTIONS = ["wind", "shortWaves", "ahead"] as const;
export type WavesFrom = (typeof WAVES_FROM_OPTIONS)[number];
export const DEFAULT_WAVES_FROM: WavesFrom = "shortWaves";

/** The short waves' turn is rounded to this many degrees: each new one rebuilds the spectrum. */
const SHORT_WAVES_TURN_STEP_DEG = 5;
const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * How to lay the sea for a wind `windSide` radians off the bow (starboard
 * positive): the sea frame's turn from head-on, in radians, and the short
 * waves' own turn on the sea, in degrees (see `FftOcean.setWind`).
 */
export function waveDirections(wavesFrom: WavesFrom, windSide: number) {
  if (wavesFrom === "wind") return { frameTurnFromHeadOn: -windSide, shortWavesTurnDeg: 0 };
  if (wavesFrom === "ahead") return { frameTurnFromHeadOn: 0, shortWavesTurnDeg: 0 };
  const turn = Math.round((windSide * DEGREES_PER_RADIAN) / SHORT_WAVES_TURN_STEP_DEG) * SHORT_WAVES_TURN_STEP_DEG;
  return { frameTurnFromHeadOn: 0, shortWavesTurnDeg: turn };
}
