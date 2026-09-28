/**
 * Seascape — 2b. Wind-driven waves
 *
 * The surface sea's waves, driven by the wind. Where `seascape-waves` is the
 * Shadertoy's sea, which boils in place, this is a sea that travels.
 *
 * Why the Shadertoy's sea boils:
 * - every octave is two copies drifting in opposite directions, which add up
 *   to standing waves — they rise and fall in place instead of travelling;
 * - each octave is turned ~37° from the last, so no direction dominates;
 * - all octaves move at one speed, where real long waves outrun short ones.
 *
 * Here, instead:
 * - every wave travels downwind, spread a little either side of the wind —
 *   little for the long waves, more for the short ones, as at sea;
 * - each wave moves at its deep-water speed, from ω² = g·k, so the long swell
 *   rolls through the short chop;
 * - waves come in groups: each crest grows at the back of its group and dies
 *   at the front, because in deep water a group travels at half the speed of
 *   its crests. That, more than anything, is what makes a sea look alive
 *   rather than like a pattern sliding past;
 * - how big the waves are, and how long, comes from the JONSWAP spectrum — the
 *   standard description of a sea raised by a wind of speed U blowing over a
 *   distance of open water F, the fetch. See `windSeaState`.
 *
 * Only the three longest octaves are computed as waves. The shorter chop is
 * drawn from a normal map instead — two layers of it, at different sizes and
 * angles, drifting downwind at those waves' own speed, as steep as the
 * spectrum says those waves are. As waves, the short octaves were two crest
 * trains each and came out as parallel stripes, "corduroy", which hid the long
 * waves; a normal map is short-crested chop by nature, and far cheaper.
 *
 * The crest shape is still the Shadertoy's — pointed crests, rounded troughs,
 * much like a Gerstner wave's profile — so the sea looks as it did, only
 * organised. It is a height field rather than Gerstner's sideways displacement
 * on purpose: the fine waves are drawn per pixel from the height field, and
 * sideways-moved vertices would not match them.
 *
 * Units: metres and seconds, in world space. The surface converts to the
 * Shadertoy's "sea space" only for the lighting, whose constants expect it.
 *
 * Rule followed in every seascape file: functions receive everything they need
 * as parameters, including the time and the sea state. A uniform read only
 * from inside a Fn that has a layout is not declared by three r183.
 */
import { dot, float, Fn, If, max, mix, pow, smoothstep, sqrt, sub, texture, vec2, vec3 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { valueNoise } from "./seascape-noise";
import { crestProfile } from "./seascape-waves";

/** Standard gravity, m/s². */
const GRAVITY = 9.81;

// JONSWAP (Hasselmann et al., 1973), for the wind at 10 m
/** Peak enhancement: how much sharper the spectrum's peak is than a fully developed sea's. */
const JONSWAP_GAMMA = 3.3;
/** Width of the peak, below and above the peak frequency. */
const JONSWAP_SIGMA_BELOW_PEAK = 0.07;
const JONSWAP_SIGMA_ABOVE_PEAK = 0.09;
/**
 * Dimensionless fetch g·F/U² beyond which the sea stops growing: the wind has
 * blown long enough for it to be fully developed, and JONSWAP's peak has
 * reached Pierson–Moskowitz's (ωp = 0.877·g/U at 19.5 m, ≈ 0.82·g/U at 10 m).
 * Past it the formulas would keep growing a sea that no longer grows.
 */
const FULLY_DEVELOPED_FETCH = 2.2e4;
/** Below this wind the sea is flat; it also keeps the formulas away from dividing by 0. */
const MIN_WIND_SPEED = 0.5;

// The waves the sea is made of
/**
 * Octaves the spectrum is split into, from the peak wavelength down. The first
 * `WAVE_OCTAVES` are drawn as waves; the rest set the strength of the normal
 * map that stands in for them — see `DETAIL_LAYERS`.
 */
const OCTAVES = 6;
const WAVE_OCTAVES = 3;
/** Each octave's wavelength is this many times shorter than the last. */
const OCTAVE_WAVELENGTH_RATIO = 2.3;
/**
 * The spectrum is sampled from this fraction of the peak frequency: below
 * half the peak, JONSWAP holds almost no energy.
 */
const LOWEST_FREQUENCY_OF_PEAK = 0.5;
/** Steps when integrating the spectrum over one octave's band. */
const BAND_INTEGRATION_STEPS = 48;
/**
 * The waves each octave is made of: how far each turns from the wind, in
 * degrees, and how long it is against the octave's wavelength.
 *
 * The longest waves stay close to the wind, the shorter ones spread wider.
 * Two crest trains crossing at mirrored angles make a diamond lattice, which
 * showed; so the angles are unrelated, the shorter octaves have three trains,
 * and no two trains are quite the same length — their crossings never repeat.
 */
const OCTAVE_WAVES = [
  [
    { turnDegrees: 10, lengthScale: 1.0 },
    { turnDegrees: -14, lengthScale: 0.91 },
  ],
  [
    { turnDegrees: 22, lengthScale: 1.0 },
    { turnDegrees: -9, lengthScale: 1.13 },
    { turnDegrees: -31, lengthScale: 0.87 },
  ],
  [
    { turnDegrees: -18, lengthScale: 1.0 },
    { turnDegrees: 34, lengthScale: 0.89 },
    { turnDegrees: 5, lengthScale: 1.17 },
  ],
];

// Crest shape (the Shadertoy's SEA_CHOPPY)
/** How pointed the longest waves' crests are: 1 is a smooth hump, higher is pointier. */
const CHOPPINESS = 2.0;
/** Each octave is 20% closer to smooth than the one before. */
const CHOPPINESS_EASING = 0.2;

// Irregular crests
/**
 * Crests are bent by noise that travels with the wave, so each crest keeps its
 * shape as it rolls. Sizes are in wavelengths: the bends vary over about two
 * wavelengths along the travel and one and a half along the crest.
 */
const CREST_BEND_SCALE = vec2(0.5, 1.0);
/** How far a crest is pushed, in radians of its phase (a whole wave is π). */
const CREST_BEND_STRENGTH = 1.1;

// Wave groups
/**
 * Size of the groups, as noise frequency in wavelengths: a group runs a few
 * wavelengths along the travel and two or three along the crest.
 */
const GROUP_SCALE = vec2(1 / 6, 1 / 2.5);
/** Height of the waves between groups, relative to those in the middle of one. */
const GROUP_FLOOR = 0.15;
/** Noise values mapped to "between groups" and "middle of a group": sharper groups than raw noise. */
const GROUP_EDGE = 0.5;
/**
 * Mean square of the group envelope, measured by sampling it (value noise
 * through the smoothstep above, from GROUP_FLOOR to 1). The envelope takes
 * that share of the waves' energy away; amplitudes are raised to give it back,
 * so the sea keeps the Hs the spectrum asks for.
 */
const GROUP_MEAN_SQUARE = 0.439;
/** In deep water a group travels at half the speed of its crests. */
const GROUP_SPEED_OF_PHASE_SPEED = 0.5;

/**
 * Anti-aliasing: a wave whose crests are closer than a few pixels — or, for the
 * grid's shape, a few vertices — cannot be drawn, only sampled into moiré. So
 * each fades out as its wavelength shrinks: whole at 4 filter sizes, gone at 2.
 */
const FADE_START_SIZES = 4.0;
const FADE_END_SIZES = 2.0;

// Short chop, from the normal map
/**
 * The normal map's slope: the root mean square of |xy| / z over the whole of
 * `SEASCAPE_CHOP_NORMALS_URL`, which was made to have it. A layer as steep as
 * the waves it stands for is this map scaled by (their slope / this).
 */
const DETAIL_MAP_RMS_SLOPE = 0.24;
/**
 * The map's ripples: half its slope is in features larger than a sixteenth of
 * a tile, half in smaller (measured from its spectrum).
 */
const DETAIL_FEATURES_PER_TILE = 16;
/**
 * Distance, in the layer's own tiles, over which it fades out: whole up to 3
 * tiles from the camera, gone by 10. Further away hundreds of identical tiles
 * line up into a visible grid, and the chop is too fine to see anyway.
 */
const DETAIL_FADE_START_TILES = 3.0;
const DETAIL_FADE_END_TILES = 10.0;
/**
 * The layers of chop, continuing the spectrum below the shortest drawn wave:
 * - `featureOfShortestWave`: its ripples' size against the shortest wave the
 *   surface draws (the peak wavelength / 2.3²), which sets its tile size and,
 *   as for any wave that size, its speed. Anchored there, the layers always
 *   start where the waves stop. (Anchored to fixed sizes of 8 m and 2 m, a
 *   storm had nothing between its 73 m waves and 8 m ripples, and its surface
 *   read as calm swell);
 * - `minFeature`: the smallest those ripples get, in metres, for low winds;
 * - `slopeShare`: its share of the chop's slope variance;
 * - `inReflection`: how much of it the sky's reflection sees. The long chop
 *   breaks up the sky's reflection into dark and light patches, as on real
 *   water; the shortest, a few metres across, drew soft white "clouds", so the
 *   reflection sees little of it and it stays in the sun's glints;
 * - `turn`: its angle against the wind, in radians, different for each so the
 *   layers never line up.
 */
const DETAIL_LAYERS = [
  { featureOfShortestWave: 0.4, minFeature: 1.5, slopeShare: 0.45, inReflection: 1.0, turn: 0.35 },
  { featureOfShortestWave: 0.15, minFeature: 0.6, slopeShare: 0.35, inReflection: 0.4, turn: -0.6 },
  { featureOfShortestWave: 0.055, minFeature: 0.25, slopeShare: 0.2, inReflection: 0.1, turn: 1.2 },
] as const;

/**
 * The sea's total mean square slope, from Cox & Munk's sun-glitter
 * measurements (1954, clean surface): 0.003 + 0.00512 · U, with U the wind in
 * m/s. The drawn waves carry part of it; the chop gets the rest, so the
 * surface roughens with the wind — 0.054 at 10 m/s, 0.105 at 20.
 */
const SLOPE_VARIANCE_CALM = 0.003;
const SLOPE_VARIANCE_PER_WIND = 0.00512;

/** The shortest drawn wave's length against the peak wavelength. */
const SHORTEST_WAVE_OF_PEAK = Math.pow(OCTAVE_WAVELENGTH_RATIO, -(WAVE_OCTAVES - 1));

/**
 * How much of the Shadertoy's crest tip is rounded off, in its profile's
 * units (the profile is 0 on the crest, ~x²/2 near it).
 *
 * The Shadertoy's crest is `1 - profile^0.65`: near the tip that is 1 - |x|^1.3,
 * whose curvature is infinite — the slope goes from flat to steep in a sliver
 * along the crest line. The sky's reflection flips from the zenith's blue to
 * the horizon's white across that sliver, and every crest drew a hard white
 * line. `(profile + this)^0.65`, rescaled, keeps the crest pointed to the eye
 * but gives its tip a finite curvature.
 */
const CREST_TIP_ROUNDING = 0.03;

/** The crest shape, 0 in the troughs and 1 on the crests: the Shadertoy's, with its tip rounded. */
function crestShape(phase: Node<"float">, choppiness: number) {
  const tip = Math.pow(CREST_TIP_ROUNDING, 0.65);
  const range = Math.pow(1 + CREST_TIP_ROUNDING, 0.65) - tip;
  const sharpened = pow(crestProfile(phase).add(CREST_TIP_ROUNDING), 0.65).sub(tip).div(range);

  return pow(sub(1.0, sharpened), choppiness);
}

/**
 * The same shape in plain JavaScript, sampled over one wave to find its mean
 * and variance: the mean centres the sea on its mean level, the variance turns
 * the spectrum's energy into an amplitude. Must stay in step with `crestShape`.
 */
function crestShapeMoments(choppiness: number) {
  const SAMPLES = 1024;
  const shapeAt = (phase: number) => {
    const rounded = 1 - Math.abs(Math.sin(phase));
    const sharp = Math.abs(Math.cos(phase));
    const profile = rounded + (sharp - rounded) * rounded;
    const tip = Math.pow(CREST_TIP_ROUNDING, 0.65);
    const sharpened = (Math.pow(profile + CREST_TIP_ROUNDING, 0.65) - tip) / (Math.pow(1 + CREST_TIP_ROUNDING, 0.65) - tip);

    return Math.pow(1 - sharpened, choppiness);
  };
  const phaseStep = Math.PI / SAMPLES;

  let sum = 0;
  let sumOfSquares = 0;
  let sumOfSquaredSlopes = 0;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const phase = phaseStep * (sample + 0.5);
    const shape = shapeAt(phase);
    const slope = (shapeAt(phase + phaseStep / 2) - shapeAt(phase - phaseStep / 2)) / phaseStep;
    sum += shape;
    sumOfSquares += shape * shape;
    sumOfSquaredSlopes += slope * slope;
  }
  const mean = sum / SAMPLES;

  return {
    mean,
    variance: sumOfSquares / SAMPLES - mean * mean,
    /** Mean square of the shape's slope per radian of phase. */
    slopeVariance: sumOfSquaredSlopes / SAMPLES,
  };
}

/**
 * Everything about each octave that does not depend on the wind, worked out
 * once, so the shader sees plain numbers.
 */
const OCTAVE_PLAN = Array.from({ length: OCTAVES }, (_, octave) => {
  const choppiness = 1.0 + (CHOPPINESS - 1.0) * Math.pow(1.0 - CHOPPINESS_EASING, octave);
  const wavelengthScale = Math.pow(OCTAVE_WAVELENGTH_RATIO, -octave);

  return {
    wavelengthScale,
    // Deep water, ω² = g·k: frequency grows with the square root of k, and the
    // speed c = sqrt(g·λ / 2π) with the square root of λ
    frequencyScale: Math.sqrt(1 / wavelengthScale),
    phaseSpeedScale: Math.sqrt(wavelengthScale),
    choppiness,
    ...crestShapeMoments(choppiness),
    waves: (OCTAVE_WAVES[octave] ?? []).map(({ turnDegrees, lengthScale }) => ({
      turn: (turnDegrees * Math.PI) / 180,
      lengthScale,
      speedScale: Math.sqrt(lengthScale),
    })),
  };
});

/** Speed of a wave per sqrt(metre of wavelength): c = sqrt(g / 2π) · sqrt(λ). */
const PHASE_SPEED_PER_ROOT_WAVELENGTH = Math.sqrt(GRAVITY / (2 * Math.PI));

/** What the wind is doing: the only inputs the sea has. */
export type Wind = {
  /** Wind speed at 10 m, in m/s. */
  speed: number;
  /**
   * Compass bearing the wind blows FROM, as weather reports give it. Bearings
   * follow the scene's sun: 0 is +Z, 90 is +X.
   */
  fromDegrees: number;
  /** Open water the wind has blown over, in metres. Longer fetch, bigger sea, up to fully developed. */
  fetch: number;
};

/** The sea a wind raises: what the shader needs, plus the headline numbers. */
export type WindSeaState = {
  /** Unit vector the waves travel along, on the xz plane: downwind. */
  travelX: number;
  travelZ: number;
  /** Wavelength of the most energetic waves, in metres. */
  peakWavelength: number;
  /** Their period, in seconds. */
  peakPeriod: number;
  /** Significant wave height Hs — the mean of the highest third of the waves — in metres. */
  significantHeight: number;
  /** Amplitude of each octave's waves, in metres, from the longest. */
  octaveAmplitudes: number[];
  /** How strongly each of `DETAIL_LAYERS` is applied: 1 is the map's own slope. */
  detailStrengths: number[];
  /** Standard deviation of the height of the waves the surface draws, in metres. */
  waveHeightDeviation: number;
};

/**
 * The JONSWAP spectrum: how the sea's energy is spread over wave frequencies ω,
 * in m²·s. A Pierson–Moskowitz ω⁻⁵ curve for a developing sea (scaled by
 * `alpha`), sharpened around its peak `peakFrequency` by γ.
 */
export function jonswapSpectrum(frequency: number, peakFrequency: number, alpha: number) {
  const sigma = frequency <= peakFrequency ? JONSWAP_SIGMA_BELOW_PEAK : JONSWAP_SIGMA_ABOVE_PEAK;
  const offPeak = (frequency - peakFrequency) / (sigma * peakFrequency);
  const peakEnhancement = Math.pow(JONSWAP_GAMMA, Math.exp(-0.5 * offPeak * offPeak));
  const pierson = ((alpha * GRAVITY * GRAVITY) / Math.pow(frequency, 5)) * Math.exp(-1.25 * Math.pow(peakFrequency / frequency, 4));

  return pierson * peakEnhancement;
}

/** The spectrum's energy between two frequencies — the variance of that band's surface, in m². */
function bandEnergy(from: number, to: number, peakFrequency: number, alpha: number) {
  const step = (to - from) / BAND_INTEGRATION_STEPS;
  let energy = 0;
  for (let index = 0; index < BAND_INTEGRATION_STEPS; index++) {
    energy += jonswapSpectrum(from + (index + 0.5) * step, peakFrequency, alpha) * step;
  }

  return energy;
}

/**
 * The sea a wind raises, from the JONSWAP fetch laws:
 *   dimensionless fetch   X = g·F / U²   (capped where the sea is fully developed)
 *   peak frequency        ωp = 22 · (g / U) · X^-0.33
 *   energy scale          α = 0.076 · X^-0.22
 *
 * Each octave takes the spectrum's energy in its band of frequencies — the
 * octaves' frequencies sit geometrically around their own, and the first also
 * takes everything below — and gets the amplitude that gives its two waves
 * that energy.
 */
/**
 * JONSWAP's two parameters for a wind — see `windSeaState` for the laws —
 * and how much of the sea it raises (0 for no wind, 1 above MIN_WIND_SPEED).
 */
export function jonswapParameters({ speed, fetch }: Pick<Wind, "speed" | "fetch">) {
  const windSpeed = Math.max(speed, MIN_WIND_SPEED);
  const dimensionlessFetch = Math.min((GRAVITY * fetch) / (windSpeed * windSpeed), FULLY_DEVELOPED_FETCH);

  return {
    peakFrequency: 22 * (GRAVITY / windSpeed) * Math.pow(dimensionlessFetch, -0.33),
    alpha: 0.076 * Math.pow(dimensionlessFetch, -0.22),
    calm: Math.min(Math.max(speed, 0) / MIN_WIND_SPEED, 1),
  };
}

export function windSeaState({ speed, fromDegrees, fetch }: Wind): WindSeaState {
  const { peakFrequency, alpha } = jonswapParameters({ speed, fetch });

  // Band edges halfway (geometrically) between neighbouring octaves' frequencies
  const bandRatio = Math.sqrt(Math.sqrt(OCTAVE_WAVELENGTH_RATIO));
  const peakWavelength = (2 * Math.PI * GRAVITY) / (peakFrequency * peakFrequency);
  const bands = OCTAVE_PLAN.map((octave, index) => {
    const frequency = peakFrequency * octave.frequencyScale;
    const from = index === 0 ? peakFrequency * LOWEST_FREQUENCY_OF_PEAK : frequency / bandRatio;
    const energy = bandEnergy(from, frequency * bandRatio, peakFrequency, alpha);
    const wavelength = peakWavelength * octave.wavelengthScale;

    return {
      energy,
      // The octave's independent waves share the band's energy, each shaped
      // by its groups: waves · a² · variance · (group envelope)² = energy
      amplitude: Math.sqrt(energy / (Math.max(octave.waves.length, 1) * octave.variance * GROUP_MEAN_SQUARE)),
      // The same waves' mean square slope: height scaled by energy / variance,
      // phase changing π per wavelength
      slopeSquared: ((energy / octave.variance) * octave.slopeVariance * Math.PI * Math.PI) / (wavelength * wavelength),
    };
  });
  const totalEnergy = bands.reduce((sum, band) => sum + band.energy, 0);

  // The wind speed was floored to keep the formulas finite; below it, the sea is flat
  const calm = Math.min(speed / MIN_WIND_SPEED, 1);
  const bearing = (fromDegrees * Math.PI) / 180;

  return {
    // The waves run the way the wind blows: away from where it comes from
    travelX: -Math.sin(bearing),
    travelZ: -Math.cos(bearing),
    peakWavelength,
    peakPeriod: (2 * Math.PI) / peakFrequency,
    // Hs is four standard deviations of the surface
    significantHeight: 4 * Math.sqrt(totalEnergy) * calm,
    octaveAmplitudes: bands.slice(0, WAVE_OCTAVES).map((band) => band.amplitude * calm),
    waveHeightDeviation:
      Math.sqrt(bands.slice(0, WAVE_OCTAVES).reduce((sum, band) => sum + band.energy, 0)) * calm,
    detailStrengths: DETAIL_LAYERS.map(({ slopeShare }) => {
      // What Cox & Munk's slope asks for, less what the drawn waves carry
      const totalSlope = SLOPE_VARIANCE_CALM + SLOPE_VARIANCE_PER_WIND * Math.max(speed, 0);
      const wavesSlope = bands.slice(0, WAVE_OCTAVES).reduce((sum, band) => sum + band.slopeSquared, 0);
      const chopSlope = Math.max(totalSlope - wavesSlope, SLOPE_VARIANCE_CALM);

      return (Math.sqrt(chopSlope * slopeShare) / DETAIL_MAP_RMS_SLOPE) * calm;
    }),
  };
}

/** A direction turned by a fixed angle. */
function turn(direction: Node<"vec2">, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return vec2(
    direction.x.mul(cosine).sub(direction.y.mul(sine)),
    direction.x.mul(sine).add(direction.y.mul(cosine))
  );
}

/** Components of a vec4, by index. */
const COMPONENTS = ["x", "y", "z", "w"] as const;

/**
 * Packs a sea state into the vec4s the shader reads:
 * - `travel`: the direction the waves travel (x, z), the peak wavelength, and Hs;
 * - `amplitudes`: the wave octaves' amplitudes (at most 4);
 * - `detail`: the normal map layers' strengths (at most 4).
 */
export function packWindSeaState(state: WindSeaState) {
  const padded = (values: number[]) => COMPONENTS.map((_, index) => values[index] ?? 0);

  return {
    travel: [state.travelX, state.travelZ, state.peakWavelength, state.significantHeight],
    amplitudes: padded(state.octaveAmplitudes),
    detail: padded(state.detailStrengths),
  };
}

/**
 * Octaves whose slope may be computed per vertex rather than per pixel: only
 * the longest waves are smooth enough to interpolate between vertices.
 */
const VERTEX_OCTAVES = 2;
/**
 * Wavelengths, in grid cells, over which an octave's slope moves from the
 * pixels to the vertices: all per pixel below 12 cells a wave, all per vertex
 * above 24. Low winds make short waves, which go back to the pixels.
 *
 * The slope is interpolated straight across each triangle, so a pointed crest
 * only a few cells long comes out as visible triangles: at 4..8 cells they
 * showed close to the camera, and at 8..16 still did once the chop's normal
 * map no longer hid them.
 */
const VERTEX_SHARE_START_CELLS = 12.0;
const VERTEX_SHARE_FULL_CELLS = 24.0;

/**
 * One wave train at a point: where the point is in the wave's cycle, and how
 * high the wave group passing over it is. Shared by the height and the
 * whitecaps, so the foam sits exactly on the crests the height draws.
 *
 * - `phase`: one crest per π, crests at π/2 + nπ (where the profile peaks);
 * - `groupNoise`: the raw group noise, from -1 between groups to 1 at their
 *   highest;
 * - `inGroups`, `noiseOffset`: for anything else that should travel with the
 *   groups.
 */
function waveTrainAt(
  position: Node<"vec2">,
  time: Node<"float">,
  travelDirection: Node<"vec2">,
  octaveWavelength: Node<"float">,
  peakPhaseSpeed: Node<"float">,
  octaveIndex: number,
  waveIndex: number
) {
  const octave = OCTAVE_PLAN[octaveIndex];
  const wave = octave.waves[waveIndex];
  const waveLength = octaveWavelength.mul(wave.lengthScale);
  const phaseSpeed = peakPhaseSpeed.mul(octave.phaseSpeedScale * wave.speedScale);
  const direction = turn(travelDirection, wave.turn);
  const along = dot(position, direction);
  const across = dot(position, vec2(direction.y.negate(), direction.x));

  // Position in the frame of the crests, which travels with them, and in the
  // frame of the groups, which travels at half their speed — both in wavelengths
  const inWave = vec2(along.sub(phaseSpeed.mul(time)), across).div(waveLength);
  const inGroups = vec2(along.sub(phaseSpeed.mul(GROUP_SPEED_OF_PHASE_SPEED).mul(time)), across).div(waveLength);

  // Each wave its own noise
  const noiseOffset = vec2(13.7 * octaveIndex + 5.1 * waveIndex, 7.3 * waveIndex);

  // Bend the crests with noise carried along by them
  const bend = valueNoise(inWave.mul(CREST_BEND_SCALE).add(noiseOffset)).mul(CREST_BEND_STRENGTH);

  return {
    phase: inWave.x.mul(Math.PI).add(bend),
    groupNoise: valueNoise(inGroups.mul(GROUP_SCALE).add(noiseOffset.yx)),
    /** Where the point is in the groups' frame, in wavelengths, and the train's own noise offset. */
    inGroups,
    noiseOffset,
  };
}

/**
 * Which share of the sea a height function sums:
 * - `all`: every octave, faded by `filterSize` — the grid's own shape;
 * - `vertex`: the part of the longest octaves the vertices take;
 * - `pixel`: everything the vertices do not, faded by `filterSize` (a pixel).
 * `vertex` + `pixel` is the whole sea, so the two slopes add up exactly.
 */
type Share = "all" | "vertex" | "pixel";

/**
 * A height function: the height of the sea above its mean level, in metres,
 * at a point on the xz plane.
 *
 * `filterSize` is the smallest distance that can still be drawn — a pixel's
 * width, or the grid's cell size for the grid's own shape. Waves too short for
 * it fade out. `cellSize` is the grid's, which decides the vertex share.
 */
function createWindSeaElevation(share: Share) {
  return Fn(
    ([position, time, travel, amplitudes, filterSize, cellSize]: [
      Node<"vec2">,
      Node<"float">,
      Node<"vec4">,
      Node<"vec4">,
      Node<"float">,
      Node<"float">,
    ]) => {
      const travelDirection = travel.xy;
      const peakWavelength = travel.z;
      const peakPhaseSpeed = sqrt(peakWavelength).mul(PHASE_SPEED_PER_ROOT_WAVELENGTH);
      // Guarded so the fade's two edges never coincide
      const filter = max(filterSize, 1e-6);

      const elevation = float(0.0).toVar();

      // The octave loop runs in JavaScript while the shader is built
      OCTAVE_PLAN.slice(0, WAVE_OCTAVES).forEach((octave, octaveIndex) => {
        const takesVertexShare = octaveIndex < VERTEX_OCTAVES;
        if (share === "vertex" && !takesVertexShare) return;

        const wavelength = peakWavelength.mul(octave.wavelengthScale);
        const visibility = smoothstep(filter.mul(FADE_END_SIZES), filter.mul(FADE_START_SIZES), wavelength);
        const vertexShare = smoothstep(
          cellSize.mul(VERTEX_SHARE_START_CELLS),
          cellSize.mul(VERTEX_SHARE_FULL_CELLS),
          wavelength
        );

        const weight =
          share === "all"
            ? visibility
            : share === "vertex"
              ? vertexShare
              : takesVertexShare
                ? visibility.mul(vertexShare.oneMinus())
                : visibility;

        // Skipped where it adds nothing: far from the camera for the short
        // waves, and — the same for every pixel, so free — for the long waves
        // whenever the vertices take them whole
        If(weight.greaterThan(0.0), () => {
          const amplitude = amplitudes[COMPONENTS[octaveIndex]];

          octave.waves.forEach((_, waveIndex) => {
            const { phase, groupNoise } = waveTrainAt(
              position,
              time,
              travelDirection,
              wavelength,
              peakPhaseSpeed,
              octaveIndex,
              waveIndex
            );

            // The groups: crests rise as a group passes over them, and fade after
            const group = mix(float(GROUP_FLOOR), float(1.0), smoothstep(-GROUP_EDGE, GROUP_EDGE, groupNoise));
            const height = crestShape(phase, octave.choppiness).sub(octave.mean);

            elevation.addAssign(height.mul(group).mul(amplitude).mul(weight));
          });
        });
      });

      return elevation;
    },
    {
      position: "vec2",
      time: "float",
      travel: "vec4",
      amplitudes: "vec4",
      filterSize: "float",
      cellSize: "float",
      return: "float",
    }
  );
}

const ELEVATION_BY_SHARE = {
  all: createWindSeaElevation("all"),
  vertex: createWindSeaElevation("vertex"),
  pixel: createWindSeaElevation("pixel"),
} as const;

/** The sea state's shader inputs, plus the grid's cell size, in metres. */
export type WindSeaNodes = {
  travel: Node<"vec4">;
  amplitudes: Node<"vec4">;
  detail: Node<"vec4">;
  cellSize: Node<"float">;
};

/** The height of the sea above its mean level, in metres: every octave, faded by `filterSize`. */
export function windSeaElevation(
  position: Node<"vec2">,
  time: Node<"float">,
  sea: WindSeaNodes,
  filterSize: Node<"float">
) {
  return ELEVATION_BY_SHARE.all(position, time, sea.travel, sea.amplitudes, filterSize, sea.cellSize);
}

/**
 * How steeply one share of the sea rises along x and z, measured over `step`
 * metres — a larger step averages over more of the surface, which calms
 * distant water — and, in z, that share's height at the point itself, which
 * the slope needs anyway. See `Share`.
 */
export function windSeaSlope(
  share: "vertex" | "pixel",
  position: Node<"vec2">,
  step: Node<"float">,
  time: Node<"float">,
  sea: WindSeaNodes,
  filterSize: Node<"float">
) {
  const elevation = ELEVATION_BY_SHARE[share];
  const heightAt = (point: Node<"vec2">) =>
    elevation(point, time, sea.travel, sea.amplitudes, filterSize, sea.cellSize);
  const here = heightAt(position);
  const alongX = heightAt(position.add(vec2(step, 0.0)));
  const alongZ = heightAt(position.add(vec2(0.0, step)));

  return vec3(vec2(alongX.sub(here), alongZ.sub(here)).div(step), here);
}

/**
 * The short chop's slope, from the normal map: each of `DETAIL_LAYERS` read in
 * its own frame, turned against the wind and drifting downwind, and scaled to
 * the slope the spectrum gives the octaves it stands for. `distance` is from
 * the camera, for fading the layers out far away (`DETAIL_FADE_START_TILES`).
 *
 * Not a Fn with a layout: it reads a texture, and is meant to be called once,
 * straight from the fragment shader, outside any branch — the texture's
 * mipmaps, which keep distant chop from flickering, need that.
 */
export function windSeaDetailSlope(
  position: Node<"vec2">,
  distance: Node<"float">,
  time: Node<"float">,
  sea: WindSeaNodes,
  normalMap: TextureNode
) {
  const shortestWave = sea.travel.z.mul(SHORTEST_WAVE_OF_PEAK);
  let slope: Node<"vec2"> = vec2(0.0, 0.0);
  let reflectionSlope: Node<"vec2"> = vec2(0.0, 0.0);

  DETAIL_LAYERS.forEach((layer, layerIndex) => {
    const featureSize = max(shortestWave.mul(layer.featureOfShortestWave), layer.minFeature);
    const tileSize = featureSize.mul(DETAIL_FEATURES_PER_TILE);
    const phaseSpeed = sqrt(featureSize).mul(PHASE_SPEED_PER_ROOT_WAVELENGTH);

    const along = turn(sea.travel.xy, layer.turn);
    const across = vec2(along.y.negate(), along.x);
    const uv = vec2(dot(position, along).sub(phaseSpeed.mul(time)), dot(position, across)).div(tileSize);

    // Tangent-space normal -> slope along the layer's own axes -> world xz
    const normal = texture(normalMap, uv).xyz.mul(2.0).sub(1.0);
    const layerSlope = normal.xy.div(max(normal.z, 0.2));
    const worldSlope = along.mul(layerSlope.x).add(across.mul(layerSlope.y));

    const nearby = smoothstep(
      tileSize.mul(DETAIL_FADE_START_TILES),
      tileSize.mul(DETAIL_FADE_END_TILES),
      distance
    ).oneMinus();

    const layerContribution = worldSlope.mul(sea.detail[COMPONENTS[layerIndex]]).mul(nearby);
    slope = slope.add(layerContribution);
    reflectionSlope = reflectionSlope.add(layerContribution.mul(layer.inReflection));
  });

  return { slope, reflectionSlope };
}

// Whitecaps
/**
 * Share of the sea white with breaking waves at wind speed U (m/s at 10 m):
 * W = 3.84e-6 · U^3.41 (Monahan & O'Muircheartaigh, 1980). About 1% at
 * 10 m/s, 4% at 15, 10% at 20 and 21% at 25.
 */
const WHITECAP_COVERAGE_SCALE = 3.84e-6;
const WHITECAP_COVERAGE_EXPONENT = 3.41;
/**
 * Most of the sea the whitecaps may cover, whatever the wind and `amount`.
 * Monahan's fit was measured up to about 25 m/s (21%); past that it runs away
 * — 69% at 35 m/s, a white sheet. Storm seas are streaked with foam, but most
 * of it is the thin kind, not whitecaps.
 */
const MAX_WHITECAP_COVERAGE = 0.25;
/**
 * Whitecap amount above which foam reads as white. The whitecaps rise from 0
 * to 1 across their edge, so this is its middle — where Monahan's coverage is
 * measured to.
 */
export const VISIBLE_WHITECAP = 0.5;
/** How wide the whitecaps' edge is, in standard deviations of the sea's height. */
const WHITECAP_EDGE_WIDTH = 0.5;
/**
 * How much the breaking noise raises or lowers a crest, in standard deviations
 * of the height: some crests break, their neighbours of the same height don't.
 */
const BREAKING_VARIATION = 0.8;
/** How much the foam's grain raises or lowers its edge, in standard deviations of the height. */
const GRAIN_EDGE_VARIATION = 0.35;
/**
 * Size of the breaking noise, as frequency per peak wavelength: stretches
 * about two thirds of a wavelength along the travel and a third across it.
 * It travels with the wave groups, at half the peak waves' speed, so a crest
 * runs into a stretch, whitens, and runs out of it.
 */
const BREAKING_SCALE = vec2(1.5, 3.0);
/** Offset for the breaking noise, so it is unrelated to the waves' own. */
const BREAKING_NOISE_OFFSET = vec2(31.7, 11.3);
/**
 * The breaking noise is two layers of value noise, the second this much finer
 * and turned: one layer alone, cut near its peaks, gives stretches with the
 * straight sides and corners of the grid it is built on.
 */
const BREAKING_DETAIL_SCALE = 2.13;
const BREAKING_DETAIL_TURN = 1.1;
/** Standard deviation of that noise, measured by sampling the same two layers. */
const BREAKING_NOISE_DEVIATION = 0.319;

/** The breaking noise at a point, in [-1, 1]: see BREAKING_DETAIL_SCALE. */
function breakingNoiseAt(position: Node<"vec2">) {
  const cosine = Math.cos(BREAKING_DETAIL_TURN);
  const sine = Math.sin(BREAKING_DETAIL_TURN);
  const detailPosition = vec2(
    position.x.mul(cosine).sub(position.y.mul(sine)),
    position.x.mul(sine).add(position.y.mul(cosine))
  ).mul(BREAKING_DETAIL_SCALE);

  // Weights 2 : 1
  return valueNoise(position).mul(2.0).add(valueNoise(detailPosition)).div(3.0);
}

/**
 * z such that a standard normal variable is above z with probability `share`
 * (0 < share ≤ 0.5): the rational approximation of Abramowitz & Stegun 26.2.23,
 * good to 4.5e-4.
 */
function normalAbove(share: number) {
  const t = Math.sqrt(-2 * Math.log(share));

  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}

/**
 * Where whitecaps start, for a sea state: the vec4 `windSeaWhitecaps` reads —
 * (height of the whitecaps' edge, half its width, breaking variation, the
 * height's standard deviation), all in metres.
 *
 * A crest breaks where it stands high above the mean level. The sea's height
 * is close to normally distributed with standard deviation σ (Hs = 4σ for the
 * whole spectrum; here, of the waves the surface draws), so the edge is put
 * where that share of the sea — breaking noise included — lies above it.
 * `amount` scales the coverage: 1 is the law, more for a rougher look.
 */
export function whitecapLevels(state: WindSeaState, windSpeed: number, amount: number) {
  const deviation = Math.max(state.waveHeightDeviation, 1e-3);
  const coverage = Math.min(
    WHITECAP_COVERAGE_SCALE * Math.pow(Math.max(windSpeed, 0), WHITECAP_COVERAGE_EXPONENT) * Math.max(amount, 0),
    MAX_WHITECAP_COVERAGE
  );
  // The breaking noise widens the spread of what is compared against the edge
  const spread = deviation * Math.sqrt(1 + Math.pow(BREAKING_VARIATION * BREAKING_NOISE_DEVIATION, 2));
  // No wind, no foam: an edge nothing reaches
  const edge = coverage > 0 ? spread * normalAbove(coverage) : 1e6;

  return [edge, (WHITECAP_EDGE_WIDTH * deviation) / 2, BREAKING_VARIATION * deviation, deviation];
}

/**
 * How much whitecap foam lies at a point, from 0 to 1: where the sea — every
 * wave together — stands high enough above its mean level to break.
 *
 * Taken from the height of the whole surface, not wave by wave: the patches
 * take the shapes of the sea's actual peaks, where crests pile up, and form and
 * dissolve as the waves run through each other. (Drawn wave by wave, from each
 * train's crest lines, the foam came out in rows with straight seams where
 * trains crossed.)
 *
 * @param height the sea's height above its mean level here, in metres
 * @param levels see `whitecapLevels`
 * @param grain  the foam's grain (0..1), which frays the edge
 */
export const windSeaWhitecaps = Fn(
  ([position, time, travel, height, levels, grain]: [
    Node<"vec2">,
    Node<"float">,
    Node<"vec4">,
    Node<"float">,
    Node<"vec4">,
    Node<"float">,
  ]) => {
    const travelDirection = travel.xy;
    const peakWavelength = travel.z;
    const groupSpeed = sqrt(peakWavelength).mul(PHASE_SPEED_PER_ROOT_WAVELENGTH * GROUP_SPEED_OF_PHASE_SPEED);

    // Where the point is in the frame of the peak waves' groups, in wavelengths
    const along = dot(position, travelDirection).sub(groupSpeed.mul(time));
    const across = dot(position, vec2(travelDirection.y.negate(), travelDirection.x));
    const inGroups = vec2(along, across).div(peakWavelength);

    const breaking = breakingNoiseAt(inGroups.mul(BREAKING_SCALE).add(BREAKING_NOISE_OFFSET)).mul(levels.z);
    const frayed = grain.sub(0.5).mul(2.0 * GRAIN_EDGE_VARIATION).mul(levels.w);
    const crest = height.add(breaking).add(frayed);

    return smoothstep(levels.x.sub(levels.y), levels.x.add(levels.y), crest);
  },
  {
    position: "vec2",
    time: "float",
    travel: "vec4",
    height: "float",
    levels: "vec4",
    grain: "float",
    return: "float",
  }
);
