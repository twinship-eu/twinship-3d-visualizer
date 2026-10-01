/**
 * Seascape — 16. Under the water
 *
 * What the camera sees once it is below the surface: water that closes in
 * within a few tens of metres, lighter looking up towards the light, darker
 * looking down into the depth; the hull fading into it; and the surface seen
 * from beneath — the sky only through Snell's window overhead, the water's own
 * colour reflected back everywhere else.
 *
 * `underwater.submerged` says how far under the camera is, from 0 (in the air)
 * to 1, from the water's height right above it (probed by the sea's
 * component). The atmosphere and the sea read these uniforms.
 */
import { atan, color, cross, dot, exp, float, length, max, mix, normalize, positionView, pow, sin, smoothstep, time, uniform, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { clearSkyColor, gammaLift } from "./seascape-lighting";
import { overcast } from "./seascape-weather";
import { skyUniforms } from "./sky-state";

/**
 * Under the water, looking down into the depth: a deep blue, not black —
 * clear ocean water lets a lot of light through. (Darker, the whole view read
 * as a black murk.)
 */
const DEEP_WATER = "#0e4a62";
/** Looking up towards the surface: the light filtering down. */
const SHALLOW_WATER = "#5cc2d2";
/** The beams' colour: lighter than the water they cross. */
const SHALLOW_WATER_RAYS = "#bfeaf0";
/** Distance at which the water hides about two thirds of what is behind it, in world units. */
const VISIBILITY = 90;
/**
 * How much darker the water gets per world unit the camera is below the
 * surface: light fades with depth.
 */
const DARKENING_PER_DEPTH = 0.006;

// Sunlight in the water
/** Towards the sun, as the scene's light comes from it: wherever the hour has put it. */
const SUN = skyUniforms.sunDirection;
/**
 * Light scattered by the water towards the camera, looking towards the sun:
 * how strong, and how tightly it gathers around the sun's direction.
 */
const SUN_SCATTER = 1.4;
const SUN_SCATTER_POWER = 5;
/**
 * The sun seen through the surface from below: where the waves bend its light
 * down towards the camera, bright moving spots — far past white, so the bloom
 * catches them. How far a wave's tilt turns the light, how tight a spot is,
 * and how bright.
 */
const SUN_BENDING = 2.5;
const SUN_SPOT_POWER = 60;
const SUN_SPOT_BRIGHTNESS = 6;

/**
 * Looking up from under the water, the sky shows only within Snell's window:
 * rays closer to the surface than the critical angle (48.6° from the vertical,
 * cos 0.66) are reflected back down. Cosines between these fade between the two.
 */
const SNELL_WINDOW_EDGE = 0.6;
const SNELL_WINDOW_FULL = 0.75;
/** How much of the sky's light comes through the window. */
const SNELL_WINDOW_TRANSMISSION = 0.9;

/** Shared by the atmosphere and the sea; written every frame by the sea's component. */
export const underwater = {
  /** How far under the camera is, from 0 (in the air) to 1. */
  submerged: uniform(0),
  /** How far below the surface the camera is, in world units (0 above it). */
  depth: uniform(0),
  /**
   * 1 while the camera is inside the hull — dry, below the waterline (the
   * engine room, with a part there focused): the sea's underside is not
   * drawn, so the part stands out clear rather than against it.
   */
  isCameraInsideHull: uniform(0),
};

/**
 * Shafts of sunlight: the light the waves focus into beams, seen in the water
 * towards the sun, spreading from it, drifting. Strongest near the surface
 * (they fade with the camera's depth), under a clear sky; none at night.
 */
const RAYS_STRENGTH = 1.3;
/** How tightly the beams gather round the sun's direction, and how many spread round it. */
const RAYS_FOCUS_POWER = 5;
const RAYS_COUNT = 18;
const RAYS_DRIFT = 0.25;
/** How fast the beams fade with the camera's depth, per world unit. */
const RAYS_DEPTH_FADE = 0.012;

function sunRays(direction: Node<"vec3">) {
  const sun = vec3(SUN);
  // The angle round the sun's axis: the beams radiate from the sun along it
  const tangent = normalize(cross(sun, vec3(0.0, 0.0, 1.0)));
  const bitangent = cross(sun, tangent);
  const angle = atan(dot(direction, bitangent), dot(direction, tangent));
  const beams = sin(angle.mul(RAYS_COUNT).add(time.mul(RAYS_DRIFT))).mul(sin(angle.mul(RAYS_COUNT * 0.37).sub(time.mul(RAYS_DRIFT * 0.6))));
  const shafts = beams.mul(0.5).add(0.5).pow(2.0);
  const towardsSun = pow(max(dot(direction, sun), 0.0), RAYS_FOCUS_POWER);
  const clear = float(1.0).sub(overcast());

  return vec3(color(SHALLOW_WATER_RAYS)).mul(shafts.mul(towardsSun)).mul(vec3(skyUniforms.sunColor)).mul(clear).mul(RAYS_STRENGTH).mul(exp(underwater.depth.mul(-RAYS_DEPTH_FADE)));
}

/** The water's colour looking in `direction`, at the camera's depth. */
export function underwaterColor(direction: Node<"vec3">) {
  const upwards = smoothstep(-0.6, 0.8, direction.y);
  const lit = vec3(mix(color(DEEP_WATER), color(SHALLOW_WATER), upwards));
  const towardsSun = pow(max(direction.dot(vec3(SUN)), 0.0), SUN_SCATTER_POWER);
  const scattered = vec3(color(SHALLOW_WATER)).mul(towardsSun.mul(SUN_SCATTER)).mul(vec3(skyUniforms.sunColor));
  // Little light is left at night, and less the deeper
  const light = exp(underwater.depth.mul(-DARKENING_PER_DEPTH)).mul(skyUniforms.ambient);

  return lit.add(scattered).mul(light).add(sunRays(direction));
}

/** How much the water hides of a fragment, from its distance to the camera: 0 to 1. */
export function underwaterFogFactor() {
  return float(1.0).sub(exp(length(positionView).div(VISIBILITY).negate()));
}

/** How much of the view from below shows the sky (and what is in front of it): inside Snell's window, 0 to 1. */

/**
 * The surface seen from below: the sky through Snell's window, the water's
 * own colour reflected back everywhere else.
 *
 * @param normal        the surface's normal, pointing up
 * @param viewDirection from the camera towards the point
 */
export function snellWindow(normal: Node<"vec3">, viewDirection: Node<"vec3">) {
  return smoothstep(SNELL_WINDOW_EDGE, SNELL_WINDOW_FULL, viewDirection.dot(normal));
}

export function surfaceFromBelow(normal: Node<"vec3">, viewDirection: Node<"vec3">) {
  const inWindow = snellWindow(normal, viewDirection);
  const sky = gammaLift(
    clearSkyColor(viewDirection, overcast(), vec3(skyUniforms.zenith), vec3(skyUniforms.horizon), skyUniforms.dim)
  ).mul(SNELL_WINDOW_TRANSMISSION);
  const reflected = underwaterColor(viewDirection.mul(vec3(1.0, -1.0, 1.0)));

  // The sun through the surface: its light, bent down by each wave's tilt
  const sun = vec3(SUN);
  const bentSun = normalize(sun.add(normal.sub(vec3(0.0, 1.0, 0.0)).mul(SUN_BENDING)));
  const sunSpot = pow(max(viewDirection.dot(bentSun), 0.0), SUN_SPOT_POWER).mul(SUN_SPOT_BRIGHTNESS);

  return mix(reflected, sky, inWindow).add(vec3(sunSpot).mul(vec3(skyUniforms.sunColor))).add(sunRays(viewDirection));
}
