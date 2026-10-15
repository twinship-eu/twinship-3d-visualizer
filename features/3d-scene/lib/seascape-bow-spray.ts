/**
 * Seascape — 24. Bow spray
 *
 * Where the stem meets a rough sea at speed, water is thrown off it: droplets
 * flung up and out, rising and falling in an arc, carried aft by the stream.
 * They read the bow wave (`seascape-bow-wave.ts`) as more than a mound — it
 * breaks. How much there is follows the speed and the sea state.
 *
 * As the bubbles are (`seascape-bubbles.ts`), every droplet is worked out on
 * the GPU from its index and the time alone: one sprite drawn SPRAY_COUNT times.
 */
import { float, fract, instanceIndex, length, max, mix, sin, smoothstep, time, uniform, uv, vec2, vec3 } from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial, type Node } from "three/webgpu";

const SPRAY_COUNT = 560;
/** Seconds a droplet is in the air, at most. */
const LIFETIME = 1.4;
/** Where it leaves the hull: along the stem and the flank, and above the water, in world units. */
/** The droplets leave the flank for this far aft of the stem, along a hull widening to its half-beam. */
const FLANK_LENGTH = 14;
const HALF_BEAM = 7.5;
/** How far off the outline a droplet may start, in world units. */
const SCATTER_OUT = 4;
const LAUNCH_HEIGHT = 0.4;
/** How hard it is thrown, in m/s: up, and out to the side, at full speed and a rough sea. */
const UP_SPEED = 7;
const OUT_SPEED = 5;
const GRAVITY = 9.8;
/** How much of the ship's speed the droplets are carried aft by (the stream carries them, less than all). */
const STREAM_SHARE = 0.75;
/** Their size when thrown and when they fall, in world units. */
const BIRTH_SIZE = 0.55;
const LATE_SIZE = 0.2;
/** Droplets to a group that surges together. */
const GROUP_SIZE = 40;
const SPRAY_OPACITY = 0.45;

const hash = (seed: Node<"float">) => fract(sin(seed.mul(12.9898)).mul(43758.5453));

/**
 * @param levelY the sea's mean level
 * @param bowZ   where the stem is, in the ship's frame
 * @param waterHeight the sea's height above its mean level at a point of the
 *   ship's frame, if known: each droplet leaves the water where it is, not the
 *   mean level — in a big sea the stem is far above it, and spray from there
 *   hung round the hull
 */
export function createBowSpray(levelY: number, bowZ: number, waterHeight?: (position: Node<"vec2">) => Node<"float">) {
  const uniforms = {
    /** The ship's speed through the water, m/s. */
    speed: uniform(0),
    /** How much spray there is, 0 to 1: the speed and the sea state, worked out on the CPU. */
    intensity: uniform(0),
  };

  const index = instanceIndex.toFloat();
  const seed = hash(index.add(0.5));
  const seedB = hash(index.add(17.3));
  const seedC = hash(index.add(41.7));
  const seedD = hash(index.add(73.1));
  const seedE = hash(index.add(97.9));

  const lifetime = float(LIFETIME).mul(seedD.mul(0.5).add(0.6));
  const age = fract(time.div(lifetime).add(seed));
  const seconds = age.mul(lifetime);

  // Each droplet its own side and strength; the stronger, the higher and further
  const side = seedB.lessThan(0.5).select(float(-1.0), float(1.0));
  const strength = seedC.mul(seedC).mul(0.8).add(0.2).mul(uniforms.intensity.mul(0.6).add(0.4));
  const up = strength.mul(UP_SPEED).mul(seedE.mul(0.8).add(0.4));
  const out = strength.mul(OUT_SPEED).mul(side);

  // Thrown off the hull's outline, thickest at the stem: squared, so more of it is near the stem
  // ...scattered, not along a line: off the outline by anything from nothing to a few metres, at all lengths
  const aft = mix(seedB.mul(seedB), seedB, seedE).mul(FLANK_LENGTH);
  const outline = smoothstep(0.0, FLANK_LENGTH, aft).mul(HALF_BEAM);
  const birthX = side.mul(outline.add(seedD.mul(seedC).mul(SCATTER_OUT)));
  const birthZ = float(bowZ).sub(aft);
  // Where the water is there (the mean level without the sea's height): the droplet leaves from it
  const water = waterHeight ? waterHeight(vec2(birthX, birthZ)).add(levelY) : float(levelY);
  const position = vec3(
    birthX.add(out.mul(seconds)),
    water.add(LAUNCH_HEIGHT).add(up.mul(seconds)).sub(seconds.mul(seconds).mul(GRAVITY * 0.5)),
    birthZ.sub(seconds.mul(uniforms.speed).mul(STREAM_SHARE))
  );

  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  // A droplet that has fallen back to the water is gone
  material.positionNode = vec3(position.x, max(position.y, water), position.z);
  material.scaleNode = mix(float(BIRTH_SIZE), float(LATE_SIZE), age).mul(seedC.mul(seedE).mul(1.6).add(0.35));

  const fromCentre = length(uv().sub(0.5)).mul(2.0);
  const disc = smoothstep(0.7, 1.0, fromCentre).oneMinus();
  const inAir = smoothstep(0.0, 0.15, position.y.sub(water));
  material.colorNode = vec3(0.95, 0.98, 1.0);
  // Surges, not a steady spray: groups of droplets come and go, each group on its own beat
  const group = index.div(GROUP_SIZE).floor();
  const beat = sin(time.mul(hash(group).mul(1.6).add(0.7)).add(hash(group.add(5.0)).mul(6.28)));
  const surge = smoothstep(-0.2, 0.6, beat);
  material.opacityNode = disc.mul(sin(age.mul(Math.PI))).mul(inAir).mul(surge).mul(uniforms.intensity).mul(SPRAY_OPACITY);

  const sprite = new Sprite(material);
  sprite.count = SPRAY_COUNT;
  sprite.frustumCulled = false;

  return { sprite, uniforms };
}

export type BowSpray = ReturnType<typeof createBowSpray>;
