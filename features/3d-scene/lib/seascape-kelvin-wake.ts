/**
 * Seascape — 14. The ship's waves: the Kelvin wake
 *
 * A ship under way pushes the water aside, and leaves behind it the same
 * pattern at any speed (Kelvin, 1887): a V of waves, 19.47° to either side of
 * its track, spreading wider the further back it goes.
 *
 * - Transverse waves across the track, at the ship's own speed: their
 *   wavelength is 2πv²/g — about 55 m at 18 knots.
 * - Divergent waves along the edges of the V: shorter, their crests slanting
 *   outwards, bunched along the V's edge (the cusp line).
 *
 * All in the ship's frame, starting from the bow: the ship stays at the origin
 * and the sea flows past it, so its waves stay with it. This is an
 * approximation of the pattern's look, not the full wave theory: plane waves
 * in the right places, with the right wavelengths and envelopes — and foam on
 * the V's crests (`kelvinWakeFoam`).
 */
import { abs, cos, exp, float, max, mix, pow, smoothstep, sqrt, texture, uniform, vec2 } from "three/tsl";
import { DataTexture, FloatType, LinearFilter, RGBAFormat, type Node } from "three/webgpu";

/** Standard gravity, m/s². */
const GRAVITY = 9.81;

/** Half-angle of the Kelvin wedge: asin(1/3), 19.47°, for any speed. */
const KELVIN_HALF_ANGLE = Math.asin(1 / 3);
const KELVIN_SLOPE = Math.tan(KELVIN_HALF_ANGLE);

/**
 * The divergent waves' crests turn this far from the track (their wave
 * vectors at 55° from it, where the pattern's cusp waves lie), and their
 * wavenumber is the transverse one over cos² of it: about three times shorter.
 */
const DIVERGENT_ANGLE = (55 * Math.PI) / 180;
/** How wide the band of divergent waves along the cusp line is, in the wedge's slope. */
const CUSP_BAND = 0.12;

/**
 * The waves' height near the ship, in world units, at FULL_WAVE_SPEED: the
 * bow wave of a hull this size at 18 knots stands about a metre high along
 * the V's edges. The transverse waves inside the V are much lower: in photos
 * of ships under way the V's edges are what shows, the inside barely.
 */
const DIVERGENT_HEIGHT = 1.2;
const TRANSVERSE_HEIGHT = 0.25;
/** Speed, in m/s, at which the waves are full height; they grow with the speed up to it. */
const FULL_WAVE_SPEED = 9;
/**
 * Speed, in m/s, below which the ship raises no waves worth drawing: its
 * wavelength, 2πv²/g, is a few metres there, and drew a fine comb of foam
 * over the whole V while the ship gathered speed.
 */
const MIN_WAVE_SPEED = 3;

// The track's history
/** Cells the history is kept in, and the track each covers, in world units: 1 km behind the bow. */
const HISTORY_CELLS = 256;
const HISTORY_CELL_LENGTH = 4;
/**
 * Seconds for the waves left on the track to die away to a third: behind a
 * ship that has stopped they are gone in under a minute. (At 60, they seemed
 * never to go.)
 */
const HISTORY_LIFETIME = 15;
/**
 * The distance, in world units, over which the waves grow in behind the
 * origin, and the one over which they decay: transverse waves as 1/√distance,
 * divergent ones slower, as distance^(-1/3), as in the theory.
 */
const GROW_IN = 15;
const DECAY_START = 40;

// Foam on the ship's waves
/** Distance behind the bow, in world units, over which the foam on the V's crests thins out. */
const FOAM_DECAY = 250;
/** Where on a divergent crest the foam starts, and where it is full (cosine of the phase). */
const FOAM_ON_CREST_START = -0.3;
const FOAM_ON_CREST_FULL = 1.0;
/** How far out from the V's edge the foam reaches, as a share of CUSP_BAND. */
const FOAM_CUSP_NARROWING = 1.0;
/**
 * The foam between the crests, against on them: the V's edge is a continuous
 * white line in photos, its crests only brighter along it. (Only on the
 * crests, it came out as sparse dashes.)
 */
const FOAM_BETWEEN_CRESTS = 0.45;

/**
 * What the ship did along its track: for every few metres behind the bow, the
 * speed it had when it passed there, and how much of the waves it raised
 * there are left. The waves are drawn from it, not from the speed now — so
 * they only reach back as far as the ship has sailed, keep the wavelength
 * they were raised with, and die away behind a ship that has stopped.
 * (Drawn from the speed now, the whole V appeared at once as the ship set off,
 * and stretched and shrank all together as it sped up and slowed down.)
 */
export function createKelvinHistory() {
  const data = new Float32Array(HISTORY_CELLS * 4);
  const history = new DataTexture(data, HISTORY_CELLS, 1, RGBAFormat, FloatType);
  history.minFilter = LinearFilter;
  history.magFilter = LinearFilter;
  history.needsUpdate = true;
  const historyTexture = texture(history);
  let unshifted = 0;
  /** How far the ship has sailed since the history last moved on a cell, in world units. */
  const sailedSinceShift = uniform(0);

  /** Moves the history on: the ship sailed `sailed` world units at `speed` m/s, `elapsed` seconds on. */
  function update(sailed: number, speed: number, elapsed: number) {
    // Shift by whole cells as the track passes under the bow
    unshifted += sailed;
    const cells = Math.min(Math.floor(unshifted / HISTORY_CELL_LENGTH), HISTORY_CELLS);
    if (cells > 0) {
      data.copyWithin(cells * 4, 0, (HISTORY_CELLS - cells) * 4);
      for (let cell = 0; cell < cells; cell++) {
        data[cell * 4] = speed;
        data[cell * 4 + 1] = 1;
      }
      unshifted -= cells * HISTORY_CELL_LENGTH;
    }
    // The bow's own cell always holds the speed now, and fresh waves
    data[0] = speed;
    data[1] = 1;
    sailedSinceShift.value = unshifted;
    // Everything left behind dies away
    const kept = Math.exp(-elapsed / HISTORY_LIFETIME);
    for (let cell = 1; cell < HISTORY_CELLS; cell++) data[cell * 4 + 1] *= kept;
    history.needsUpdate = true;
  }

  /** The speed the ship had (x) and the share of its waves left (y), `behind` world units behind the bow. */
  function at(behind: Node<"float">) {
    // The cells lie where they were when the history last moved on, and the
    // ship has sailed on since: read them that much further back, so the
    // waves slide with the water instead of stepping a cell at a time
    const u = max(behind.sub(sailedSinceShift), 0.0)
      .div(HISTORY_CELLS * HISTORY_CELL_LENGTH)
      .add(0.5 / HISTORY_CELLS);
    const sample = historyTexture.sample(vec2(u.min(1.0), 0.5));

    return vec2(sample.x, u.lessThan(1.0).select(sample.y, 0.0));
  }

  return { update, at };
}

export type KelvinHistory = ReturnType<typeof createKelvinHistory>;

/** Everything the height and the foam share, at a point in the ship's frame. */
function wakeParts(position: Node<"vec2">, track: KelvinHistory, origin: number) {
  const behindTrack = float(origin).sub(position.y);
  const passed = track.at(behindTrack);
  const speed = passed.x;
  const safeSpeed = max(speed, 0.5);
  // Transverse wavenumber: waves travelling at the ship's speed, k = g / v²
  const transverseWavenumber = float(GRAVITY).div(safeSpeed.mul(safeSpeed));
  const divergentWavenumber = transverseWavenumber.div(Math.cos(DIVERGENT_ANGLE) ** 2);

  // Distance behind the origin, and how far out towards the wedge's edge
  const behind = behindTrack;
  const across = abs(position.x);
  const behindSafe = max(behind, 1.0);
  const outwards = across.div(behindSafe);

  // Only behind the origin, grown in over the first metres
  const started = smoothstep(0.0, GROW_IN, behind);
  // Bigger the faster the ship went, up to full height, and fading with age
  const strength = smoothstep(MIN_WAVE_SPEED / FULL_WAVE_SPEED, 1.0, speed.div(FULL_WAVE_SPEED)).mul(passed.y);

  // Transverse waves: across the track, filling the wedge, fading at its edge
  // (1 - smoothstep rather than reversed edges, which WGSL rejects as constants)
  const insideWedge = smoothstep(KELVIN_SLOPE * 0.6, KELVIN_SLOPE, outwards).oneMinus();
  const transverse = cos(behind.mul(transverseWavenumber))
    .mul(insideWedge)
    .mul(sqrt(float(DECAY_START).div(behindSafe.add(DECAY_START))));

  // Divergent waves: slanting outwards, bunched along the cusp line
  const alongCusp = outwards.sub(KELVIN_SLOPE).div(CUSP_BAND);
  const onCusp = exp(alongCusp.mul(alongCusp).negate());
  const divergentPhase = across
    .mul(Math.sin(DIVERGENT_ANGLE))
    .add(behind.mul(Math.cos(DIVERGENT_ANGLE)))
    .mul(divergentWavenumber);
  const divergentWave = cos(divergentPhase);
  const divergent = divergentWave.mul(onCusp).mul(pow(float(DECAY_START).div(behindSafe.add(DECAY_START)), 1 / 3));

  return { behind, alongCusp, divergentWave, transverse, divergent, started, strength };
}

/**
 * The Kelvin wake's height at a point, in the ship's frame, in world units.
 *
 * @param position the point on the xz plane, the ship at the origin, bow at +z
 * @param track    what the ship did along its track: see `createKelvinHistory`
 * @param origin   where along z the pattern starts: the bow
 */
export function kelvinWakeHeight(position: Node<"vec2">, track: KelvinHistory, origin: number) {
  const { transverse, divergent, started, strength } = wakeParts(position, track, origin);

  return transverse.mul(TRANSVERSE_HEIGHT).add(divergent.mul(DIVERGENT_HEIGHT)).mul(started).mul(strength);
}

/**
 * How much foam the ship's waves carry at a point, from 0 to 1: on the crests
 * of the divergent waves along the V's edges, white near the bow and thinning
 * out behind — the white V of a ship under way.
 */
export function kelvinWakeFoam(position: Node<"vec2">, track: KelvinHistory, origin: number) {
  const { behind, alongCusp, divergentWave, started, strength } = wakeParts(position, track, origin);
  const narrowed = alongCusp.div(FOAM_CUSP_NARROWING);
  // A Gaussian across the V's edge, eased to nothing by four band widths out,
  // so its tails end softly rather than lingering as a faint haze
  const onEdge = exp(narrowed.mul(narrowed).negate()).mul(smoothstep(0.0, 1.0, float(1.0).sub(narrowed.abs().mul(0.25))));
  const onCrest = smoothstep(FOAM_ON_CREST_START, FOAM_ON_CREST_FULL, divergentWave);
  const fresh = exp(max(behind, 0.0).div(FOAM_DECAY).negate());

  return onEdge.mul(mix(float(FOAM_BETWEEN_CRESTS), float(1.0), onCrest)).mul(fresh).mul(started).mul(strength);
}

/**
 * The Kelvin wake's slope at a point (x, z), by finite differences over `step`
 * world units — see `kelvinWakeHeight`.
 */
export function kelvinWakeSlope(position: Node<"vec2">, track: KelvinHistory, origin: number, step: number) {
  const here = kelvinWakeHeight(position, track, origin);
  const alongX = kelvinWakeHeight(position.add(vec2(step, 0.0)), track, origin);
  const alongZ = kelvinWakeHeight(position.add(vec2(0.0, step)), track, origin);

  return vec2(alongX.sub(here), alongZ.sub(here)).div(step);
}
