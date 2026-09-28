/**
 * Seascape — 21. Rain and snow
 *
 * What falls round the camera: rain as fast, short streaks (a drop seen
 * falling, blurred by its speed), snow as slow,
 * drifting flakes, both blown by the wind round the ship (`apparentWind`) —
 * the true wind and the ship's own way through the air. Only near it — a box FALL_BOX across that moves with the camera,
 * each drop wrapping round inside it — which is all that can be seen of it;
 * further out the rain is the haze (`seascape-atmosphere-tsl.ts`).
 *
 * Every drop is worked out on the GPU from its index, the time and where the
 * camera is — nothing per drop on the CPU: one sprite drawn DROP_COUNT times,
 * the rain's and the snow's drops sharing it and fading with their amounts
 * (`weather.rain`, `weather.snow`).
 */
import {
  cameraPosition,
  float,
  fract,
  instanceIndex,
  length,
  mix,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { Sprite, SpriteNodeMaterial, Vector2, type Node } from "three/webgpu";
import { weather } from "./seascape-weather";

/**
 * Drops in the box: rain, then snow. The box is 60 across round the camera, so
 * it takes tens of thousands to read as rain rather than a few specks; each is
 * a point, drawn in one call.
 */
const RAIN_DROPS = 60000;
const SNOW_DROPS = 16000;
const DROP_COUNT = RAIN_DROPS + SNOW_DROPS;
/** The box round the camera the drops fall through, in world units. */
const FALL_BOX = 60;
/** How fast rain and snow fall, in m/s. */
const RAIN_SPEED = 13;
const SNOW_SPEED = 1.2;
/**
 * How much of the wind's speed rain and snow take: heavy drops fall through
 * it, light flakes are carried nearly with it.
 */
const RAIN_WIND_SHARE = 0.35;
const SNOW_WIND_SHARE = 0.85;
/** How much snow sways as it falls, in world units. */
const SNOW_SWAY = 0.6;
/**
 * A raindrop as seen falling: a short, thin streak, in world units. (As a
 * round point it looked like slow snow.)
 */
const RAIN_WIDTH = 0.03;
const RAIN_LENGTH = 0.45;
/** How far under the surface a drop is hidden, in world units: none is seen in the water. */
const SURFACE_MARGIN = 0.05;
/** A snowflake's size, in world units. */
const SNOW_SIZE = 0.09;
/** How opaque a drop gets at most, in a downpour: rain is faint, snow whiter. */
const RAIN_OPACITY = 0.6;
const SNOW_OPACITY = 0.9;
/** Drops fade out towards the box's edge, so its wrap is never seen. */
const EDGE_FADE = 0.35;

/** A pseudo-random number in [0, 1) from a seed: the usual sine hash. */
function hash(seed: Node<"float">) {
  return fract(sin(seed.mul(12.9898)).mul(43758.5453));
}

/**
 * A drop's place in the box round the camera: its seeded place, fallen for
 * `fallen` world units and blown `blown` sideways, wrapped so it stays in the box.
 */
function inBox(seed: Node<"vec3">, fallen: Node<"float">, blown: Node<"vec2">) {
  const fromCorner = vec3(seed.x.add(blown.x), seed.y.sub(fallen), seed.z.add(blown.y)).mul(FALL_BOX);
  // Wrapped round the camera: the box's corner is the camera's place, rounded
  const corner = cameraPosition.sub(FALL_BOX / 2);
  const wrapped = fract(fromCorner.sub(corner).div(FALL_BOX)).mul(FALL_BOX);

  return corner.add(wrapped);
}

/**
 * @param levelY      the water's mean level, in world units
 * @param waterHeight the sea's height above it at a point of the scene, if
 *   known: nothing is drawn below it. Without it, below the mean level.
 */
export function createPrecipitation(levelY: number, waterHeight?: (position: Node<"vec2">) => Node<"float">) {
  /** How far the wind has carried the air since the start, in world units: accumulated, so a change of wind never jumps the drops. */
  const blownBy = uniform(new Vector2());
  const index = instanceIndex.toFloat();
  const isSnow = index.greaterThanEqual(RAIN_DROPS);
  const seed = vec3(hash(index.add(0.5)), hash(index.add(19.1)), hash(index.add(47.3)));
  const phase = hash(index.add(83.7));

  // Rain falls straight and fast; snow slowly, blown and swaying
  const rainFallen = time.mul(RAIN_SPEED).div(FALL_BOX);
  const snowFallen = time.mul(SNOW_SPEED).div(FALL_BOX);
  const sway = sin(time.mul(0.8).add(phase.mul(6.28))).mul(SNOW_SWAY / FALL_BOX);
  const snowBlown = blownBy.mul(SNOW_WIND_SHARE / FALL_BOX).add(vec2(sway, sway.mul(0.6)));
  const rainBlown = blownBy.mul(RAIN_WIND_SHARE / FALL_BOX);
  const position = isSnow.select(inBox(seed, snowFallen, snowBlown), inBox(seed, rainFallen, rainBlown));

  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
  material.positionNode = position;
  // A flake round, a raindrop a thin streak along its fall
  material.scaleNode = isSnow.select(vec2(SNOW_SIZE, SNOW_SIZE), vec2(RAIN_WIDTH, RAIN_LENGTH));

  // How far out in the box: fading towards its edge, so the wrap is not seen
  const fromCamera = length(position.sub(cameraPosition)).div(FALL_BOX / 2);
  const edgeFade = smoothstep(1.0 - EDGE_FADE, 1.0, fromCamera).oneMinus();

  // A soft disc
  const fromCentre = length(uv().sub(0.5)).mul(2.0);
  const shape = smoothstep(0.4, 1.0, fromCentre).oneMinus();
  const amount = isSnow.select(weather.snow, weather.rain);
  const opacity = isSnow.select(float(SNOW_OPACITY), float(RAIN_OPACITY));

  material.colorNode = mix(vec3(0.78, 0.84, 0.9), vec3(1.0), isSnow.select(float(1.0), float(0.0)));
  // Nothing under the water: the drop ends at the surface, where its rings are
  const surface = waterHeight ? waterHeight(position.xz).add(levelY) : float(levelY);
  const aboveWater = position.y.greaterThan(surface.add(SURFACE_MARGIN)).select(float(1.0), float(0.0));
  material.opacityNode = shape.mul(edgeFade).mul(amount).mul(opacity).mul(aboveWater);

  const sprite = new Sprite(material);
  sprite.count = DROP_COUNT;
  sprite.frustumCulled = false;

  /** Carries the air on by the wind round the ship (m/s), `elapsed` seconds on. */
  function update(wind: { x: number; z: number }, elapsed: number) {
    blownBy.value.x += wind.x * elapsed;
    blownBy.value.y += wind.z * elapsed;
  }

  return { sprite, update };
}

export type Precipitation = ReturnType<typeof createPrecipitation>;
