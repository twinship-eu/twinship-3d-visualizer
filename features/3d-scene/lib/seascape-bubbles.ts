/**
 * Seascape — 17. Bubbles
 *
 * The air the propellers and the hull drag under the water, seen from below:
 * - from each propeller, a spiral of bubbles thrown out by its blades and
 *   swept back by the flow — the faster the ship, the longer and the denser;
 * - behind the stern, a cloud of churned bubbles rising towards the surface.
 *
 * Every bubble is worked out on the GPU from its index and the time alone —
 * where it was born, how old it is — so there is nothing to update per bubble
 * on the CPU: one sprite drawn BUBBLE_COUNT times (`sprite.count`).
 */
import {
  cos,
  float,
  fract,
  instanceIndex,
  length,
  max,
  min,
  mix,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial, type Node } from "three/webgpu";

// The propellers, in the ship's frame (measured from the model, at the ship's origin height)
/** Their hubs across the ship, and below and behind its origin, in world units. */
const PROPELLER_OFFSET_X = 3.15;
const PROPELLER_BELOW_ORIGIN = 3.1;
const PROPELLER_Z = -47.3;
/** Where the blades throw the bubbles out: about the blades' tips. */
const PROPELLER_RADIUS = 1.2;

// The bubbles
/** Bubbles per propeller, and in the stern's cloud. */
const PROPELLER_BUBBLES = 320;
const STERN_BUBBLES = 420;
const BUBBLE_COUNT = PROPELLER_BUBBLES * 2 + STERN_BUBBLES;
/** Seconds a bubble lives, for the propellers' spirals and the stern's cloud. */
const PROPELLER_LIFETIME = 3;
const STERN_LIFETIME = 5;
/** How fast the spiral turns, in radians per second: with the blades, slowed by the water. */
const SPIRAL_TURN = 9;
/** How much the spiral widens over a bubble's life, in world units. */
const SPIRAL_WIDENING = 1.6;
/** How fast the propellers' wash carries the bubbles back, beyond the water's own flow, in m/s. */
const WASH_SPEED = 2;
/** How fast bubbles rise, in m/s. */
const RISE_SPEED = 0.6;
/** The stern's cloud: how wide and how deep it starts, in world units. */
const STERN_CLOUD_WIDTH = 12;
const STERN_CLOUD_DEPTH = 5;
/** Bubbles stop this far under the water's mean level: at the surface they have burst. */
const SURFACE_MARGIN = 0.4;
/** A bubble's size when born and when it bursts, in world units. */
const BIRTH_SIZE = 0.12;
const OLD_SIZE = 0.35;
/** Ship speed, in m/s, at which there are all the bubbles; slower, fewer, and a few at rest. */
const FULL_SPEED = 9;
const AT_REST = 0.15;
/** How bright and how opaque a bubble is at most. */
const BUBBLE_OPACITY = 0.55;

/** A pseudo-random number in [0, 1) from a seed: the usual sine hash. */
function hash(seed: Node<"float">) {
  return fract(sin(seed.mul(12.9898)).mul(43758.5453));
}

/**
 * @param waterHeight the sea's height above its mean level at a point of the
 *   ship's frame, if known: bubbles are kept under it. Without it, under the
 *   mean level — which a wave's trough dips below, and bubbles showed above it.
 */
export function createBubbles(levelY: number, waterHeight?: (position: Node<"vec2">) => Node<"float">) {
  const uniforms = {
    /** The ship's speed through the water, in m/s. */
    speed: uniform(0),
    /** The ship's origin height, as it rides the waves, in world units. */
    shipY: uniform(0),
  };

  const index = instanceIndex.toFloat();
  const isStern = index.greaterThanEqual(PROPELLER_BUBBLES * 2);
  const seed = hash(index.add(0.5));
  const seedB = hash(index.add(17.3));
  const seedC = hash(index.add(41.7));
  const seedD = hash(index.add(73.1));
  const seedE = hash(index.add(97.9));

  // Each bubble its own: lifetime, turn, radius, size — none quite alike
  const lifetime = isStern
    .select(float(STERN_LIFETIME), float(PROPELLER_LIFETIME))
    .mul(seedD.mul(0.6).add(0.7));
  const age = fract(time.div(lifetime).add(seed));
  const seconds = age.mul(lifetime);
  const sweptBack = seconds.mul(uniforms.speed.add(WASH_SPEED));

  // A propeller's spiral: out from the blades' tips, turning with them, swept
  // back; each bubble turning at its own rate, from its own radius, wobbling
  const side = index.mod(2.0).mul(2.0).sub(1.0);
  const turnRate = seedE.mul(0.8).add(0.6).mul(SPIRAL_TURN);
  const angle = seedB.mul(Math.PI * 2).sub(seconds.mul(turnRate).mul(side));
  const wobble = sin(seconds.mul(seedC.mul(6.0).add(3.0)).add(seedD.mul(6.28))).mul(0.25);
  const radius = age
    .mul(SPIRAL_WIDENING)
    .add(PROPELLER_RADIUS)
    .add(seedC.sub(0.5).mul(1.0))
    .add(wobble);
  const hubY = uniforms.shipY.sub(PROPELLER_BELOW_ORIGIN);
  const spiral = vec3(
    side.mul(PROPELLER_OFFSET_X).add(cos(angle).mul(radius)),
    hubY.add(sin(angle).mul(radius)),
    float(PROPELLER_Z).sub(sweptBack).sub(seedD.mul(1.5))
  );

  // The stern's cloud: spread across it and down it, rising as it falls behind
  const cloud = vec3(
    seedB.sub(0.5).mul(STERN_CLOUD_WIDTH).mul(age.add(1.0)),
    hubY.sub(seedC.mul(STERN_CLOUD_DEPTH)).add(seconds.mul(RISE_SPEED)),
    float(PROPELLER_Z).sub(sweptBack.mul(0.8))
  );

  // Never above the water: bubbles burst at the surface
  const born = isStern.select(cloud, spiral);
  const surface = waterHeight ? waterHeight(born.xz).add(levelY) : float(levelY);
  const position = vec3(born.x, min(born.y, surface.sub(SURFACE_MARGIN)), born.z);

  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  material.positionNode = position;
  material.scaleNode = mix(float(BIRTH_SIZE), float(OLD_SIZE), age).mul(seedE.mul(0.9).add(0.55));

  // A bubble: a bright rim and a clearer middle, fading in and out over its life
  const fromCentre = length(uv().sub(0.5)).mul(2.0);
  // (1 - smoothstep rather than reversed edges, which WGSL rejects as constants)
  const disc = smoothstep(0.75, 1.0, fromCentre).oneMinus();
  const rim = mix(float(0.35), float(1.0), smoothstep(0.4, 0.9, fromCentre));
  const lifeFade = sin(age.mul(Math.PI));
  const busy = max(smoothstep(0.0, FULL_SPEED, uniforms.speed), float(AT_REST));
  material.colorNode = vec3(0.85, 0.95, 1.0);
  material.opacityNode = disc.mul(rim).mul(lifeFade).mul(busy).mul(BUBBLE_OPACITY);

  const sprite = new Sprite(material);
  sprite.count = BUBBLE_COUNT;
  sprite.frustumCulled = false;

  return { sprite, uniforms };
}

export type Bubbles = ReturnType<typeof createBubbles>;
