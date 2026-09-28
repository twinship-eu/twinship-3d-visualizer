/**
 * Seascape — 2. Waves
 *
 * The height of the sea at any point: several octaves of choppy waves stacked
 * on top of each other, each smaller, faster-varying and more rotated than the
 * last.
 *
 * Names in the original GLSL:
 *   sea_octave    -> waveOctave
 *   map           -> seaElevation          (and `heightAboveSea` in the tracer)
 *   map_detailed  -> seaElevationDetailed
 *   getNormal     -> seaSlopeDetailed (plus a normal built from the slope)
 *
 * Rule followed in every seascape file: functions receive everything they need
 * as parameters, including the time. A uniform read only from inside a Fn that
 * has a layout is not declared by three r183, and the shader fails to compile
 * ("struct member nodeUniform0 not found").
 */
import { abs, cos, float, Fn, max, mix, pow, sin, smoothstep, sub, vec2 } from "three/tsl";
import type { Node } from "three/webgpu";
import { valueNoise } from "./seascape-noise";

// Waves (the GLSL SEA_* constants)
/** Height of the largest octave. Also the sea's reference level. (SEA_HEIGHT) */
export const WAVES_AMPLITUDE = 0.6;
/** How sharp the crests are: 1 is smooth, higher is pointier. (SEA_CHOPPY) */
const WAVES_CHOPPINESS = 2.0;
/** How fast the waves move. (SEA_SPEED) */
export const WAVES_SPEED = 0.8;
/** Spatial frequency of the largest octave. (SEA_FREQ) */
const WAVES_FREQUENCY = 0.16;

// How each octave differs from the previous one
const OCTAVE_FREQUENCY_GAIN = 1.9;
const OCTAVE_AMPLITUDE_GAIN = 0.22;
/** Each octave is 20% closer to smooth (choppiness 1) than the one before. */
const OCTAVE_CHOPPINESS_EASING = 0.2;

/**
 * Anti-aliasing: an octave whose crests are closer together than a couple of
 * pixels cannot be drawn, only sampled — and a regular pattern sampled at a
 * regular pixel grid turns into moiré, the too-perfect rows seen when zoomed
 * out. So each fine octave fades out as its period shrinks on screen: fully
 * there at 4 pixels per period, gone at 2.
 */
const OCTAVE_FADE_START_PIXELS = 4.0;
const OCTAVE_FADE_END_PIXELS = 2.0;

/** Octaves that make up the shape of the sea. (ITER_GEOMETRY) */
export const GEOMETRY_OCTAVES = 3;
/** Octaves used for the normals: the shape plus the finer ripples. (ITER_FRAGMENT) */
export const DETAIL_OCTAVES = 5;

/**
 * Where the surface splits its normal between vertex and pixel: octaves below
 * this are computed per vertex and interpolated, the rest per pixel.
 *
 * Each octave is ~3.8x finer than the one before (frequency x1.9, and the
 * rotation also doubles the scale), with periods of roughly 20, 5 and 1.4 sea
 * units for octaves 0, 1 and 2. Only octave 0 is smooth enough to interpolate
 * between the surface grid's vertices without losing the crests.
 *
 * Measured at 1080p with the grid at 320 segments, GPU time vs difference
 * from the all-per-pixel version:
 *   0 -> 2.90 ms, identical
 *   1 -> 2.14 ms, indistinguishable (mean 1.6/255)   <- chosen
 *   2 -> 1.54 ms, visibly softer crests (mean 5.8/255)
 */
export const LARGE_WAVE_OCTAVES = 1;

/**
 * The profile of the crests along one axis, from 0 to 1.
 *
 * `1 - |sin|` gives rounded humps, `|cos|` sharper peaks; blending by the
 * rounded one keeps the tops rounded and the troughs pinched.
 */
export function crestProfile(coordinate: Node<"float">) {
  const rounded = sub(1.0, abs(sin(coordinate)));
  const sharp = abs(cos(coordinate));

  return mix(rounded, sharp, rounded);
}

/**
 * One octave of waves: a grid of crests, 0 in the troughs and 1 on the tops.
 */
export const waveOctave = Fn(
  ([position_immutable, choppiness]: [Node<"vec2">, Node<"float">]) => {
    // Wobble the grid with noise so the crests are not straight lines
    const position = position_immutable.add(valueNoise(position_immutable)).toVar();

    // Crests along x times crests along z: a field of peaks
    const peaks = crestProfile(position.x).mul(crestProfile(position.y));

    // Sharpen with the choppiness
    return pow(sub(1.0, pow(peaks, 0.65)), choppiness);
  },
  { position: "vec2", choppiness: "float", return: "float" }
);

// Ripples
/**
 * How coarse the noise that bends the ripples is: the bends vary over about
 * three crests, so neighbouring crests curve differently.
 */
const RIPPLE_WARP_SCALE = 0.35;
/** How far the crests are pushed, in the octave's own units (a crest is π wide). */
const RIPPLE_WARP_STRENGTH = 1.6;
/** Offset for the second noise lookup, so the warp's x and y are unrelated. */
const RIPPLE_WARP_DECORRELATION = vec2(17.3, 41.9);

/**
 * A fine ripple octave, with its lattice broken up.
 *
 * `waveOctave` is a grid of crests, barely wobbled. For the large waves that is
 * the Seascape look; for the finest octaves, only a pixel or two across, the
 * grid reads as rows too regular to be water. So before evaluating the octave,
 * its position is bent by a coarser noise field — every patch of ripples ends
 * up curved a different way, and no rows can line up.
 */
export const rippleOctave = Fn(
  ([position, choppiness]: [Node<"vec2">, Node<"float">]) => {
    const warpAt = position.mul(RIPPLE_WARP_SCALE);
    const warp = vec2(valueNoise(warpAt), valueNoise(warpAt.add(RIPPLE_WARP_DECORRELATION)));

    return waveOctave(position.add(warp.mul(RIPPLE_WARP_STRENGTH)), choppiness);
  },
  { position: "vec2", choppiness: "float", return: "float" }
);

type OctaveRange = {
  /** First octave to add, counting from 0. */
  fromOctave: number;
  /** Octave to stop before. */
  toOctave: number;
};

/**
 * How visible an octave should be, given how large one pixel is: 1 when its
 * crests are at least OCTAVE_FADE_START_PIXELS apart on screen, 0 below
 * OCTAVE_FADE_END_PIXELS, smooth in between.
 */
function octaveVisibility(period: number, pixelSize: Node<"float">) {
  // Guard against a zero-sized pixel, so the fade edges never coincide
  const pixel = max(pixelSize, 1e-6);

  return smoothstep(pixel.mul(OCTAVE_FADE_END_PIXELS), pixel.mul(OCTAVE_FADE_START_PIXELS), period);
}

/**
 * Sums octaves `fromOctave` .. `toOctave - 1` of the sea at `position`.
 *
 * The octave loop runs here, in JavaScript, while the shader is being built.
 * So each octave's frequency, amplitude, choppiness and on-screen size are
 * plain numbers in the shader, rather than values recomputed per pixel.
 *
 * With `pixelSize` (one pixel's width, in sea units), octaves too fine to draw
 * are faded out — see OCTAVE_FADE_START_PIXELS. The same variant also breaks up
 * the octaves finer than the geometry — see `rippleOctave`.
 */
function sumOctaves(
  { fromOctave, toOctave }: OctaveRange,
  position: Node<"vec2">,
  seaTime: Node<"float">,
  pixelSize?: Node<"float">
) {
  // Squash x a little so the waves do not form a square grid
  const uv = vec2(position.x.mul(0.75), position.y).toVar();
  const elevation = float(0.0).toVar();

  let frequency = WAVES_FREQUENCY;
  let amplitude = WAVES_AMPLITUDE;
  let choppiness = WAVES_CHOPPINESS;
  /** How much the rotation has scaled `uv` so far: doubles every octave. */
  let uvScale = 1.0;

  for (let octave = 0; octave < toOctave; octave++) {
    if (octave >= fromOctave) {
      // Two copies of the octave drifting in opposite directions, so the sea
      // churns instead of sliding sideways
      // Octaves finer than the geometry only ever shade the surface, so on the
      // filtered path they can be randomised without the normals disagreeing
      // with the shape the grid was lifted to
      const isRipple = pixelSize !== undefined && octave >= GEOMETRY_OCTAVES;
      const octaveShape = isRipple ? rippleOctave : waveOctave;

      const forward = octaveShape(uv.add(seaTime).mul(frequency), choppiness);
      const backward = octaveShape(uv.sub(seaTime).mul(frequency), choppiness);
      const octaveHeight = forward.add(backward).mul(amplitude);

      if (pixelSize) {
        // Distance between crests: |sin| repeats every π of its argument
        const period = Math.PI / (uvScale * frequency);
        elevation.addAssign(octaveHeight.mul(octaveVisibility(period, pixelSize)));
      } else {
        elevation.addAssign(octaveHeight);
      }
    }

    // Next octave: rotate the pattern by ~37° and double its scale, so no two
    // octaves line up.
    //
    // Direction note: this rotates the opposite way from the Shadertoy. The
    // GLSL `uv *= mat2(1.6, 1.2, -1.2, 1.6)` fills its matrix column by column,
    // three's mat2() row by row, so the transpiled port came out transposed —
    // and that version is the one that looked better, so it is kept on purpose.
    // The Shadertoy's own direction would be x' = 1.6x + 1.2y, y' = 1.6y - 1.2x.
    const isLastOctave = octave === toOctave - 1;
    if (!isLastOctave) {
      uv.assign(vec2(uv.x.mul(1.6).sub(uv.y.mul(1.2)), uv.x.mul(1.2).add(uv.y.mul(1.6))));
    }

    frequency *= OCTAVE_FREQUENCY_GAIN;
    amplitude *= OCTAVE_AMPLITUDE_GAIN;
    choppiness += (1.0 - choppiness) * OCTAVE_CHOPPINESS_EASING;
    uvScale *= 2.0;
  }

  return elevation;
}

/** A sea-height function over an octave range. */
function createSeaElevation(range: OctaveRange) {
  return Fn(
    ([position, seaTime]: [Node<"vec2">, Node<"float">]) => sumOctaves(range, position, seaTime),
    { position: "vec2", seaTime: "float", return: "float" }
  );
}

/** A sea-height function over an octave range, with octaves too fine for the pixel faded out. */
function createFilteredSeaElevation(range: OctaveRange) {
  return Fn(
    ([position, seaTime, pixelSize]: [Node<"vec2">, Node<"float">, Node<"float">]) =>
      sumOctaves(range, position, seaTime, pixelSize),
    { position: "vec2", seaTime: "float", pixelSize: "float", return: "float" }
  );
}

/** The shape of the sea: what the ray hits, or what the grid is displaced by. (map) */
export const seaElevation = createSeaElevation({
  fromOctave: 0,
  toOctave: GEOMETRY_OCTAVES,
});

/** Every octave, fine ripples included. Used for normals. (map_detailed) */
export const seaElevationDetailed = createSeaElevation({
  fromOctave: 0,
  toOctave: DETAIL_OCTAVES,
});

/**
 * The large, smooth waves only: octaves 0 .. LARGE_WAVE_OCTAVES - 1.
 */
export const seaElevationLargeWaves = createSeaElevation({
  fromOctave: 0,
  toOctave: LARGE_WAVE_OCTAVES,
});

/**
 * The finer ripples only: every octave `seaElevationLargeWaves` leaves out. The
 * two sum to exactly `seaElevationDetailed`, which lets the surface compute the
 * smooth octaves per vertex and only these per pixel.
 */
export const seaElevationRipples = createFilteredSeaElevation({
  fromOctave: LARGE_WAVE_OCTAVES,
  toOctave: DETAIL_OCTAVES,
});

/**
 * How steeply a height function rises along x and along z at a point, measured
 * over a distance `step`: the finite differences inside the GLSL `getNormal`.
 * A larger `step` averages over more of the surface.
 */
function slopeOf(heightAt: (position: Node<"vec2">) => Node<"float">, position: Node<"vec2">, step: Node<"float">) {
  const here = heightAt(position);
  const alongX = heightAt(position.add(vec2(step, 0.0)));
  const alongZ = heightAt(position.add(vec2(0.0, step)));

  return vec2(alongX.sub(here), alongZ.sub(here)).div(step);
}

function createSeaSlope(elevation: typeof seaElevation) {
  return Fn(
    ([position, step, seaTime]: [Node<"vec2">, Node<"float">, Node<"float">]) =>
      slopeOf((point) => elevation(point, seaTime), position, step),
    { position: "vec2", step: "float", seaTime: "float", return: "vec2" }
  );
}

function createFilteredSeaSlope(elevation: typeof seaElevationRipples) {
  return Fn(
    ([position, step, seaTime, pixelSize]: [Node<"vec2">, Node<"float">, Node<"float">, Node<"float">]) =>
      slopeOf((point) => elevation(point, seaTime, pixelSize), position, step),
    { position: "vec2", step: "float", seaTime: "float", pixelSize: "float", return: "vec2" }
  );
}

export const seaSlopeDetailed = createSeaSlope(seaElevationDetailed);
export const seaSlopeLargeWaves = createSeaSlope(seaElevationLargeWaves);
/** Slope of the fine ripples, with octaves too small for the pixel faded out. */
export const seaSlopeRipples = createFilteredSeaSlope(seaElevationRipples);
