/**
 * Seascape — 9a. The FFT ocean's spectrum
 *
 * The waves the FFT ocean adds up, worked out on the CPU when the wind
 * changes: which wavenumbers each cascade holds, and every wave's random
 * amplitude and phase, from the wind's JONSWAP spectrum.
 */
import { jonswapParameters, jonswapSpectrum, type Wind } from "./seascape-wind-waves";

/** Standard gravity, m/s². */
const GRAVITY = 9.81;

/** FFT grid size of each cascade. */
export const FFT_SIZE = 256;
/** Cascades, from the largest tile down. */
export const FFT_CASCADES = 3;

/**
 * Each cascade's tile is this many times smaller than the one before: not a
 * whole number, so the tiles' repeats never line up.
 */
const CASCADE_SHRINK = 13.7;

/** The first tile spans this many peak wavelengths, so the longest waves have room. */
const FIRST_TILE_OF_PEAK = 5;

/** Smallest first tile, in metres, for low winds. */
const MIN_FIRST_TILE = 40;

/**
 * A cascade takes the waves from where the one before stops: the next tile's
 * waves that fit this many times across it. Longer ones are left to the
 * bigger tile, which draws them with more than enough samples.
 */
const BAND_START_WAVES_PER_TILE = 6;

/**
 * Directional spreading, Longuet-Higgins' cos^2s(θ/2) around the wind: s = 8
 * keeps most of the energy within ±40° of the wind, with a little in every
 * direction — the short-crested look of a wind sea.
 */
const SPREADING_EXPONENT = 8;

/** Seed for the waves' random phases: the same sea on every load. */
export const SPECTRUM_SEED = 20260925;

/** Mulberry32: a small seeded random number generator in [0, 1). */
export function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A pair of independent standard normal numbers (Box–Muller). */
function gaussianPair(random: () => number): [number, number] {
  const radius = Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12)));
  const angle = 2 * Math.PI * random();

  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Normalisation of cos^2s(θ/2) over the circle: Γ(s+1) / (2√π Γ(s+½)), for whole s. */
function spreadingNormalisation(s: number) {
  // Γ(s+1)/Γ(s+½) for whole s, by the product (s)(s-1)…1 / ((s-½)(s-3/2)…½ · √π)
  let ratio = 1 / Math.sqrt(Math.PI);
  for (let n = 1; n <= s; n++) ratio *= n / (n - 0.5);

  return ratio / (2 * Math.sqrt(Math.PI));
}

/** Tile sizes of the cascades, in metres, for a sea with this peak wavelength. */
export function cascadeTileSizes(peakWavelength: number) {
  const first = Math.max(peakWavelength * FIRST_TILE_OF_PEAK, MIN_FIRST_TILE);

  return Array.from({ length: FFT_CASCADES }, (_, index) => first / Math.pow(CASCADE_SHRINK, index));
}

/**
 * One cascade's initial spectrum: for every wavenumber k of its grid inside
 * its band, the wave's complex amplitude h0(k) and conj(h0(-k)) — packed as a
 * vec4 per grid cell, in FFT order (index 0 is k = 0, the upper half negative).
 *
 * h0(k) = (ξr + iξi) · sqrt(E(k) Δk² / 4), with E(k) the directional
 * wavenumber spectrum: JONSWAP's S(ω) · D(θ) · (dω/dk) / k. (The 4: ξr + iξi
 * has a mean square of 2, and h(k, t) adds h0(k) and h0(-k), which doubles it
 * again — so each wavenumber carries E(k) Δk², and the sea's variance is ∫E.)
 */
export function buildCascadeSpectrum(
  wind: Wind,
  tileSize: number,
  band: { from: number; to: number },
  random: () => number
) {
  const { peakFrequency, alpha, calm } = jonswapParameters(wind);
  const bearing = (wind.fromDegrees * Math.PI) / 180;
  const travel = [-Math.sin(bearing), -Math.cos(bearing)];
  const spacing = (2 * Math.PI) / tileSize;
  const normalisation = spreadingNormalisation(SPREADING_EXPONENT);

  const amplitudes = new Float32Array(FFT_SIZE * FFT_SIZE * 2);
  for (let row = 0; row < FFT_SIZE; row++) {
    for (let column = 0; column < FFT_SIZE; column++) {
      const [xi, eta] = gaussianPair(random);
      const kx = (column < FFT_SIZE / 2 ? column : column - FFT_SIZE) * spacing;
      const kz = (row < FFT_SIZE / 2 ? row : row - FFT_SIZE) * spacing;
      const k = Math.hypot(kx, kz);
      if (k < band.from || k >= band.to || k === 0) continue;

      const frequency = Math.sqrt(GRAVITY * k);
      const cosine = (kx * travel[0] + kz * travel[1]) / k;
      const halfAngleCosine = Math.sqrt(Math.max((1 + cosine) / 2, 0));
      const spreading = normalisation * Math.pow(halfAngleCosine, 2 * SPREADING_EXPONENT);
      const energy = (jonswapSpectrum(frequency, peakFrequency, alpha) * spreading * (GRAVITY / (2 * frequency))) / k;
      const scale = Math.sqrt((energy * spacing * spacing) / 4) * calm;

      const index = (row * FFT_SIZE + column) * 2;
      amplitudes[index] = xi * scale;
      amplitudes[index + 1] = eta * scale;
    }
  }

  // Pack h0(k) with conj(h0(-k)), which the time evolution needs next to it
  const packed = new Float32Array(FFT_SIZE * FFT_SIZE * 4);
  for (let row = 0; row < FFT_SIZE; row++) {
    for (let column = 0; column < FFT_SIZE; column++) {
      const here = (row * FFT_SIZE + column) * 2;
      const mirrored = (((FFT_SIZE - row) % FFT_SIZE) * FFT_SIZE + ((FFT_SIZE - column) % FFT_SIZE)) * 2;
      const out = (row * FFT_SIZE + column) * 4;
      packed[out] = amplitudes[here];
      packed[out + 1] = amplitudes[here + 1];
      packed[out + 2] = amplitudes[mirrored];
      packed[out + 3] = -amplitudes[mirrored + 1];
    }
  }

  return packed;
}

/** The cascades' wavenumber bands: each starts where the next tile's waves are short enough. */
export function cascadeBands(tileSizes: number[]) {
  return tileSizes.map((_, index) => ({
    from: index === 0 ? 0 : (2 * Math.PI * BAND_START_WAVES_PER_TILE) / tileSizes[index],
    to:
      index === tileSizes.length - 1
        ? Infinity
        : (2 * Math.PI * BAND_START_WAVES_PER_TILE) / tileSizes[index + 1],
  }));
}

