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
import { color, exp, float, length, max, mix, normalize, positionView, pow, smoothstep, uniform, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { getSunDirection } from "./3d-scene-config";
import { clearSkyColor, gammaLift } from "./seascape-lighting";
import { overcast } from "./seascape-weather";

/**
 * Under the water, looking down into the depth: a deep blue, not black —
 * clear ocean water lets a lot of light through. (Darker, the whole view read
 * as a black murk.)
 */
const DEEP_WATER = "#0e4a62";
/** Looking up towards the surface: the light filtering down. */
const SHALLOW_WATER = "#5cc2d2";
/** Distance at which the water hides about two thirds of what is behind it, in world units. */
const VISIBILITY = 90;
/**
 * How much darker the water gets per world unit the camera is below the
 * surface: light fades with depth.
 */
const DARKENING_PER_DEPTH = 0.006;

// Sunlight in the water
/** Towards the sun, as the scene's light comes from it. */
const SUN = getSunDirection().normalize();
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
};

/** The water's colour looking in `direction`, at the camera's depth. */
export function underwaterColor(direction: Node<"vec3">) {
  const upwards = smoothstep(-0.6, 0.8, direction.y);
  const lit = vec3(mix(color(DEEP_WATER), color(SHALLOW_WATER), upwards));
  const towardsSun = pow(max(direction.dot(vec3(SUN.x, SUN.y, SUN.z)), 0.0), SUN_SCATTER_POWER);
  const scattered = vec3(color(SHALLOW_WATER)).mul(towardsSun.mul(SUN_SCATTER));
  const light = exp(underwater.depth.mul(-DARKENING_PER_DEPTH));

  return lit.add(scattered).mul(light);
}

/** How much the water hides of a fragment, from its distance to the camera: 0 to 1. */
export function underwaterFogFactor() {
  return float(1.0).sub(exp(length(positionView).div(VISIBILITY).negate()));
}

/**
 * The surface seen from below: the sky through Snell's window, the water's
 * own colour reflected back everywhere else.
 *
 * @param normal        the surface's normal, pointing up
 * @param viewDirection from the camera towards the point
 */
export function surfaceFromBelow(normal: Node<"vec3">, viewDirection: Node<"vec3">) {
  const upwards = viewDirection.dot(normal);
  const inWindow = smoothstep(SNELL_WINDOW_EDGE, SNELL_WINDOW_FULL, upwards);
  const sky = gammaLift(clearSkyColor(viewDirection, overcast())).mul(SNELL_WINDOW_TRANSMISSION);
  const reflected = underwaterColor(viewDirection.mul(vec3(1.0, -1.0, 1.0)));

  // The sun through the surface: its light, bent down by each wave's tilt
  const sun = vec3(SUN.x, SUN.y, SUN.z);
  const bentSun = normalize(sun.add(normal.sub(vec3(0.0, 1.0, 0.0)).mul(SUN_BENDING)));
  const sunSpot = pow(max(viewDirection.dot(bentSun), 0.0), SUN_SPOT_POWER).mul(SUN_SPOT_BRIGHTNESS);

  return mix(reflected, sky, inWindow).add(vec3(sunSpot));
}
