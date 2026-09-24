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
import { abs, cos, float, Fn, mix, pow, sin, sub, vec2 } from "three/tsl";
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
 * units for octaves 0, 1 and 2. The surface grid's vertices are 1.25 apart, so
 * only octave 0 is smooth enough to interpolate without losing the crests.
 *
 * Measured at 1080p, GPU time vs difference from the all-per-pixel version:
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
function crestProfile(coordinate: Node<"float">) {
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

type OctaveRange = {
  /** First octave to add, counting from 0. */
  fromOctave: number;
  /** Octave to stop before. */
  toOctave: number;
};

/**
 * Builds a sea-height function that sums octaves `fromOctave` .. `toOctave - 1`.
 *
 * The octave loop runs here, in JavaScript, while the shader is being built.
 * So each octave's frequency, amplitude and choppiness are plain numbers in the
 * shader, rather than values recomputed per pixel.
 */
function createSeaElevation({ fromOctave, toOctave }: OctaveRange) {
  return Fn(
    ([position, seaTime]: [Node<"vec2">, Node<"float">]) => {
      // Squash x a little so the waves do not form a square grid
      const uv = vec2(position.x.mul(0.75), position.y).toVar();
      const elevation = float(0.0).toVar();

      let frequency = WAVES_FREQUENCY;
      let amplitude = WAVES_AMPLITUDE;
      let choppiness = WAVES_CHOPPINESS;

      for (let octave = 0; octave < toOctave; octave++) {
        if (octave >= fromOctave) {
          // Two copies of the octave drifting in opposite directions, so the
          // sea churns instead of sliding sideways
          const forward = waveOctave(uv.add(seaTime).mul(frequency), choppiness);
          const backward = waveOctave(uv.sub(seaTime).mul(frequency), choppiness);
          elevation.addAssign(forward.add(backward).mul(amplitude));
        }

        // Next octave: rotate the pattern by ~37° and double its scale, so no
        // two octaves line up.
        //
        // Direction note: this rotates the opposite way from the Shadertoy.
        // The GLSL `uv *= mat2(1.6, 1.2, -1.2, 1.6)` fills its matrix column by
        // column, three's mat2() row by row, so the transpiled port came out
        // transposed — and that version is the one that looked better, so it
        // is kept on purpose. The Shadertoy's own direction would be
        // x' = 1.6x + 1.2y, y' = 1.6y - 1.2x.
        const isLastOctave = octave === toOctave - 1;
        if (!isLastOctave) {
          uv.assign(vec2(uv.x.mul(1.6).sub(uv.y.mul(1.2)), uv.x.mul(1.2).add(uv.y.mul(1.6))));
        }

        frequency *= OCTAVE_FREQUENCY_GAIN;
        amplitude *= OCTAVE_AMPLITUDE_GAIN;
        choppiness += (1.0 - choppiness) * OCTAVE_CHOPPINESS_EASING;
      }

      return elevation;
    },
    { position: "vec2", seaTime: "float", return: "float" }
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
export const seaElevationRipples = createSeaElevation({
  fromOctave: LARGE_WAVE_OCTAVES,
  toOctave: DETAIL_OCTAVES,
});

type Elevation = typeof seaElevation;

/**
 * Builds a function returning how steeply `elevation` rises along x and along
 * z at a point, measured over a distance `step`.
 *
 * The finite differences inside the GLSL `getNormal`. A larger `step` averages
 * over more of the surface, which is how the far sea stays calm instead of
 * shimmering.
 */
function createSeaSlope(elevation: Elevation) {
  return Fn(
    ([position, step, seaTime]: [Node<"vec2">, Node<"float">, Node<"float">]) => {
      const here = elevation(position, seaTime);
      const alongX = elevation(position.add(vec2(step, 0.0)), seaTime);
      const alongZ = elevation(position.add(vec2(0.0, step)), seaTime);

      return vec2(alongX.sub(here), alongZ.sub(here)).div(step);
    },
    { position: "vec2", step: "float", seaTime: "float", return: "vec2" }
  );
}

export const seaSlopeDetailed = createSeaSlope(seaElevationDetailed);
export const seaSlopeLargeWaves = createSeaSlope(seaElevationLargeWaves);
export const seaSlopeRipples = createSeaSlope(seaElevationRipples);
