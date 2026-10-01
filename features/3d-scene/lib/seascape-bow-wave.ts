/**
 * Seascape — 23. The bow wave
 *
 * A ship under way pushes the water up before its stem and along its flanks:
 * a mound that rises steeply to the stem, not a flat foam. Its height grows
 * with the square of the speed (the pressure of the stream on the stem), and
 * more in a rough sea, which the hull meets with more of its own speed. The
 * sea's height is lifted by it in the ship's frame, and its slope is added to
 * the normal, so the light bends round it.
 *
 * Every number is in the ship's frame, bow at +z, in world units.
 */
import { exp, float, max, min, mix, smoothstep, time, uniform, vec2 } from "three/tsl";
import { valueNoise } from "./seascape-noise";
import type { Node } from "three/webgpu";

/** Speed (m/s) at which the mound is full height, and the height then in calm water, world units. */
const FULL_SPEED = 10;
const CALM_HEIGHT = 1.3;
/** A rough sea adds to it: at this significant wave height, the mound is this much higher again. */
const ROUGH_HS = 4;
const ROUGH_GAIN = 0.9;
/**
 * The mound is a rounded dome at the stem — long aft, short and steep ahead —
 * and a ridge climbing the flank, both smooth, not boxes. Lengths and widths
 * are the dome's: aft, ahead, across.
 */
const DOME_AFT = 8;
const DOME_AHEAD = 1.7;
const DOME_ACROSS = 5;
/** The ridge along the flank: where it sits off the hull's outline, how wide, how long, and its share of the mound. */
const HALF_BEAM = 7.5;
const STEM_TO_FULL_BEAM = 14;
const RIDGE_WIDTH = 3.2;
const RIDGE_LENGTH = 22;
const RIDGE_SHARE = 0.45;
/** Foam sits on the mound's top: from this share of its full height, full by the second — condensed at the stem. */
const FOAM_FROM = 0.28;
const FOAM_FULL = 0.7;
/** The torn edge: the noise's scale (per world unit), and how much of the ship's speed the foam is carried aft by. */
const FOAM_NOISE_SCALE = 0.45;
const FOAM_FLOW_SHARE = 0.6;
const FLANK_STREAK_STRENGTH = 0.9;
/** The slope is measured over this many world units. */
const SLOPE_STEP = 0.5;

export const bowWave = {
  /** The ship's speed through the water, m/s. */
  speed: uniform(0),
  /** The sea's significant wave height, metres. */
  waveHeight: uniform(0),
};

/** The mound's shape at a point (x, z) of the ship's frame: about 0 to 1.2, before speed and sea state scale it. */
function bowWaveParts(position: Node<"vec2">, bowZ: number) {
  const along = float(bowZ).sub(position.y);
  const dz = along.greaterThan(0.0).select(along.div(DOME_AFT), along.div(DOME_AHEAD));
  const dx = position.x.div(DOME_ACROSS);
  const dome = exp(dx.mul(dx).add(dz.mul(dz)).negate());

  const outline = smoothstep(0.0, STEM_TO_FULL_BEAM, max(along, 0.0)).mul(HALF_BEAM);
  const off = position.x.abs().sub(outline).sub(RIDGE_WIDTH * 0.5);
  const ridge = exp(off.mul(off).div(RIDGE_WIDTH * RIDGE_WIDTH).negate())
    .mul(exp(max(along, 0.0).div(RIDGE_LENGTH).negate()))
    .mul(smoothstep(-2.0, 1.0, along));

  return { dome, ridge };
}

/** The mound's shape at a point: the dome and the ridge together. */
function bowWaveShape(position: Node<"vec2">, bowZ: number) {
  const { dome, ridge } = bowWaveParts(position, bowZ);

  return dome.add(ridge.mul(RIDGE_SHARE));
}

/** How big the mound is for the ship's speed and the sea: its height at shape 1, in world units. */
function bowWaveScale() {
  const fraction = min(bowWave.speed.div(FULL_SPEED), 1.5);
  const roughness = float(1.0).add(min(bowWave.waveHeight.div(ROUGH_HS), 1.0).mul(ROUGH_GAIN));

  return fraction.mul(fraction).mul(CALM_HEIGHT).mul(roughness);
}

/** The mound's height at a point of the ship's frame (x, z), world units. */
export function bowWaveHeight(position: Node<"vec2">, bowZ: number) {
  return bowWaveShape(position, bowZ).mul(bowWaveScale());
}

/**
 * Foam on the mound, 0 to 1: a round, dense patch at the stem, its edge torn by
 * noise and carried aft with the water, and streaks trailing along the flank —
 * not the mound's own outline, which drew a trapezoid. More the faster the ship.
 */
export function bowWaveFoam(position: Node<"vec2">, bowZ: number) {
  const fraction = min(bowWave.speed.div(FULL_SPEED), 1.0);
  const { dome, ridge } = bowWaveParts(position, bowZ);
  // Carried aft with the water, in the ship's frame
  const flowing = position.add(vec2(0.0, time.mul(bowWave.speed).mul(FOAM_FLOW_SHARE)));
  const torn = valueNoise(flowing.mul(FOAM_NOISE_SCALE)).mul(0.5).add(0.5);
  const fine = valueNoise(flowing.mul(FOAM_NOISE_SCALE * 3.1).add(vec2(4.2, 1.7))).mul(0.5).add(0.5);
  const breaking = torn.mul(0.7).add(fine.mul(0.3));

  const patch = smoothstep(FOAM_FROM, FOAM_FULL, dome.mul(breaking.mul(0.9).add(0.45)));
  const streaks = smoothstep(0.45, 0.8, breaking).mul(ridge).mul(FLANK_STREAK_STRENGTH);

  return max(patch, streaks).mul(smoothstep(0.1, 0.6, fraction));
}

/** Its slope (x, z), by finite differences. */
export function bowWaveSlope(position: Node<"vec2">, bowZ: number) {
  const here = bowWaveHeight(position, bowZ);
  const alongX = bowWaveHeight(position.add(vec2(SLOPE_STEP, 0.0)), bowZ);
  const alongZ = bowWaveHeight(position.add(vec2(0.0, SLOPE_STEP)), bowZ);

  return vec2(alongX.sub(here), alongZ.sub(here)).div(SLOPE_STEP);
}
