/**
 * Seascape — 12. The ship on the waves
 *
 * How a ship at rest moves with the sea: it heaves up and down, pitches bow
 * to stern and rolls side to side, as the waves under it lift one end or one
 * side more than the other.
 *
 * - The sea under the hull: its height at a grid of points over the hull's
 *   waterplane (`seascape-wave-probes.ts`), and the plane that fits them best.
 *   Averaged over the hull, waves much shorter than the ship cancel out — a
 *   200 m ship barely notices a 20 m wave, and rides a 200 m one.
 * - The ship's inertia: it does not snap to that plane, it is pulled towards
 *   it, like a damped spring with a ship's natural periods. So it lags,
 *   overshoots a little, and moves with the slow weight of a big hull — but
 *   never drifts far from the sea under it (MAX_HEAVE_DRIFT).
 *
 * The result is read by the ship's own component (`shipMotion`), which adds it
 * to its resting pose.
 */
import type { ProbePoint } from "./seascape-wave-probes";

type Hull = {
  /** Half the hull's length along z, in world units. */
  halfLength: number;
  /** Half its beam along x. */
  halfBeam: number;
};

// The probes
/** Probes along the hull and across it. */
const PROBES_ALONG = 5;
const PROBES_ACROSS = 3;
/** Share of the hull's half-length and half-beam the probe grid spans. */
const PROBE_SPREAD = 0.85;

// The ship's response: natural periods in seconds, and damping ratios
/**
 * Natural periods of a ship of this size, and how damped each motion is.
 * Heave and pitch are damped strongly (the hull pushes a lot of water up and
 * down); roll barely, which is why ships keep rolling after a wave has passed.
 */
const RESPONSE = {
  heave: { period: 5, damping: 0.7 },
  pitch: { period: 5, damping: 0.7 },
  roll: { period: 14, damping: 0.15 },
} as const;
/**
 * How far the ship's heave may drift from the sea under it, in world units.
 * The spring alone lags a long wave by a quarter of a turn or so, and on a
 * 35 m/s sea the ship was left hanging over a trough the crest had left: a
 * floating hull cannot — buoyancy pulls it back far harder than the spring.
 */
const MAX_HEAVE_DRIFT = 1.5;
/**
 * Pitch and roll are not limited: held within 2° of the sea's slope, the roll
 * had to follow the slope across the beam wave by wave, and the ship jerked
 * side to side every few seconds instead of rolling on its own slow period.
 */
const UNLIMITED = Infinity;
// Under way
/** Speed through the water, in m/s, the numbers below are given at: 18 knots. */
const REFERENCE_SPEED = 9.26;
/**
 * How much of the waves' effect is left at REFERENCE_SPEED and above. Under
 * way, a ship meets the waves faster than their own period and its speed
 * damps its pitch and roll: it rides them more steadily than at rest.
 */
const WAVE_RESPONSE_UNDER_WAY = 0.55;
/**
 * Squat at REFERENCE_SPEED: how far the ship sinks, in world units, and how
 * far it trims by the stern, in radians (0.3°). Both grow with the speed
 * squared: the faster water under the hull lowers the pressure there.
 */
const SQUAT_SINKAGE = 0.4;
const SQUAT_TRIM = 0.3 * (Math.PI / 180);

/** Longest time step taken at once, in seconds: a stalled tab must not fling the ship. */
const MAX_STEP = 1 / 20;

/** How the ship sits on the waves right now: added to its resting pose. */
export const shipMotion = {
  /** Up and down, in world units. */
  heave: 0,
  /** Rotation about x, in radians (positive dips the bow at +z). */
  pitch: 0,
  /** Rotation about z, in radians (positive lifts the side at +x). */
  roll: 0,
  /**
   * The ship's world height as last placed, whatever mode it is in — written
   * by the ship's component, read by what follows it (the camera).
   */
  shipY: 0,
  /**
   * The part of the ship's height the waves give it, in world units: what the
   * camera follows. Not the lift for inspecting a part — following that, the
   * camera kept drifting after the part it had framed.
   */
  waveY: 0,
  /** The ship's speed through the water, in m/s — written by the sea, read by the propellers. */
  speed: 0,
};

/** The probe grid over a hull's waterplane, centred on the origin. */
export function hullProbePoints({ halfLength, halfBeam }: Hull): ProbePoint[] {
  const points: ProbePoint[] = [];
  for (let along = 0; along < PROBES_ALONG; along++) {
    for (let across = 0; across < PROBES_ACROSS; across++) {
      points.push({
        x: (across / (PROBES_ACROSS - 1) - 0.5) * 2 * halfBeam * PROBE_SPREAD,
        z: (along / (PROBES_ALONG - 1) - 0.5) * 2 * halfLength * PROBE_SPREAD,
      });
    }
  }

  return points;
}

/**
 * The plane h = mean + slopeX·x + slopeZ·z that best fits the heights at the
 * points (least squares). The grid is symmetric about the origin, so the
 * three unknowns separate.
 */
function fitPlane(points: ProbePoint[], heights: ArrayLike<number>) {
  let sum = 0;
  let sumX = 0;
  let sumZ = 0;
  let sumXX = 0;
  let sumZZ = 0;
  points.forEach((point, index) => {
    const height = heights[index] ?? 0;
    sum += height;
    sumX += height * point.x;
    sumZ += height * point.z;
    sumXX += point.x * point.x;
    sumZZ += point.z * point.z;
  });

  return {
    mean: sum / points.length,
    slopeX: sumXX > 0 ? sumX / sumXX : 0,
    slopeZ: sumZZ > 0 ? sumZ / sumZZ : 0,
  };
}

/**
 * One damped spring: a value and its speed, pulled towards a target, and
 * never further than `maxDrift` from it. At that limit the value is held
 * there, and its speed takes the target's, so it does not bounce off it.
 */
function createSpring({ period, damping }: { period: number; damping: number }, maxDrift: number) {
  const frequency = (2 * Math.PI) / period;
  let value = 0;
  let speed = 0;
  let lastTarget = 0;

  return (target: number, step: number) => {
    const acceleration = frequency * frequency * (target - value) - 2 * damping * frequency * speed;
    speed += acceleration * step;
    value += speed * step;

    const drift = value - target;
    if (Math.abs(drift) > maxDrift) {
      value = target + Math.sign(drift) * maxDrift;
      speed = step > 0 ? (target - lastTarget) / step : 0;
    }
    lastTarget = target;

    return value;
  };
}

export function createShipMotionSolver(hull: Hull) {
  const points = hullProbePoints(hull);
  const heave = createSpring(RESPONSE.heave, MAX_HEAVE_DRIFT);
  const pitch = createSpring(RESPONSE.pitch, UNLIMITED);
  const roll = createSpring(RESPONSE.roll, UNLIMITED);

  /**
   * Moves the ship on towards the sea under it, `elapsed` seconds on, sailing
   * at `speed` m/s.
   */
  function update(heights: ArrayLike<number>, elapsed: number, speed: number) {
    const step = Math.min(elapsed, MAX_STEP);
    const plane = fitPlane(points, heights);
    const underWay = Math.min(Math.max(speed / REFERENCE_SPEED, 0), 1);
    const response = 1 - (1 - WAVE_RESPONSE_UNDER_WAY) * underWay;
    const squat = Math.pow(Math.max(speed, 0) / REFERENCE_SPEED, 2);

    shipMotion.heave = heave(plane.mean * response - SQUAT_SINKAGE * squat, step);
    // Bow (at +z) on a rising sea goes up: a negative rotation about x. Squat
    // trims it by the stern: bow up, negative too
    shipMotion.pitch = pitch(-Math.atan(plane.slopeZ) * response - SQUAT_TRIM * squat, step);
    // The +x side on a rising sea goes up: a positive rotation about z
    shipMotion.roll = roll(Math.atan(plane.slopeX) * response, step);
  }

  return { points, update };
}
