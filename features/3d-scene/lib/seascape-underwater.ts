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
const SUN_SPOT_BRIGHTNESS = 6;
/** The sun's disc seen through the surface: the dot of the view with the (bent) sun at which it ends and is full — a few degrees wide, not a point. */
const SUN_DISC_EDGE = 0.99985;
const SUN_DISC_FULL = 0.99996;
/** The soft glow round it. */
const SUN_HALO_POWER = 40;
const SUN_HALO_STRENGTH = 1.2;

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
const RAYS_STRENGTH = 0.15;
/** How tightly the beams gather round the sun's direction, and how many spread round it. */
const RAYS_FOCUS_POWER = 3;
/** Whole numbers, so the pattern closes round the sun: with any other the angle's wrap left a seam. */
const RAYS_COUNT_SLOW = 13;
/** The sun's disc seen from the water, as dots of the view with its direction: its edge, where it is full, and how bright. */
/** 1 less the dot of the view with the sun at the disc's edge, at the outside sun's size scaled to 1: about a degree and a half. */
const SUN_VIEW_DISC_SPAN = 0.00035;
const SUN_VIEW_DISC_BRIGHTNESS = 2.5;
const RAYS_DRIFT = 0.25;
/** How fast the beams fade with the camera's depth, per world unit. */
const RAYS_DEPTH_FADE = 0.012;

/** Live knobs for the Inspector: how many beams, how thin, how strong, and the sun's size and glow. */
export const raysTuning = {
  /** Beams round the sun: rounded to a whole number (a fraction left a seam). */
  count: uniform(8),
  /** Higher is thinner: the power the beam pattern is raised to. */
  width: uniform(2.5),
  strength: uniform(1),
  /** The disc's size against the outside sun's: its angle scales by this. */
  sunSize: uniform(0.2),
  glow: uniform(5),
};

/**
 * @param withSun draw the sun itself too: not in the haze that hides the hull,
 *   which would put the sun on the ship
 */
export function sunRays(direction: Node<"vec3">, withSun = true) {
  const sun = vec3(SUN);
  // The angle round the sun's axis: the beams radiate from the sun along it
  const tangent = normalize(cross(sun, vec3(0.0, 0.0, 1.0)));
  const bitangent = cross(sun, tangent);
  const angle = atan(dot(direction, bitangent), dot(direction, tangent));
  const count = raysTuning.count.round();
  const beams = sin(angle.mul(count).add(time.mul(RAYS_DRIFT))).mul(sin(angle.mul(RAYS_COUNT_SLOW).sub(time.mul(RAYS_DRIFT * 0.6))));
  // ...and patchy: some of the water is lit, some is not
  const patches = sin(dot(direction, vec3(11.0, 6.0, 9.0)).sub(time.mul(0.2))).mul(0.12).add(0.88);
  const shafts = beams.mul(0.5).add(0.5).pow(raysTuning.width).mul(patches);
  const towardsSun = pow(max(dot(direction, sun), 0.0), RAYS_FOCUS_POWER);
  const clear = float(1.0).sub(overcast());
  const rays = vec3(color(SHALLOW_WATER_RAYS))
    .mul(shafts.mul(towardsSun))
    .mul(vec3(skyUniforms.sunColor))
    .mul(clear)
    .mul(raysTuning.strength)
    .mul(exp(underwater.depth.mul(-RAYS_DEPTH_FADE)));
  if (!withSun) return rays;

  // The sun itself where the beams meet: smaller than the outside sun, in a glow so its edge is barely a circle
  const onSun = dot(direction, sun);
  const size = raysTuning.sunSize.mul(raysTuning.sunSize);
  const edge = float(1.0).sub(size.mul(SUN_VIEW_DISC_SPAN));
  const full = float(1.0).sub(size.mul(SUN_VIEW_DISC_SPAN * 0.12));
  const disc = smoothstep(edge, full, onSun).mul(SUN_VIEW_DISC_BRIGHTNESS).add(pow(max(onSun, 0.0), 220.0).mul(raysTuning.glow));
  const sunItself = vec3(1.0, 0.98, 0.9).mul(disc).mul(vec3(skyUniforms.sunColor)).mul(clear);

  return sunItself.add(rays);
}

/** The water's colour looking in `direction`, at the camera's depth. */
export function underwaterColor(direction: Node<"vec3">, withRays = true, withSun = true) {
  const upwards = smoothstep(-0.6, 0.8, direction.y);
  const lit = vec3(mix(color(DEEP_WATER), color(SHALLOW_WATER), upwards));
  const towardsSun = pow(max(direction.dot(vec3(SUN)), 0.0), SUN_SCATTER_POWER);
  const scattered = vec3(color(SHALLOW_WATER)).mul(towardsSun.mul(SUN_SCATTER)).mul(vec3(skyUniforms.sunColor));
  // Little light is left at night, and less the deeper
  const light = exp(underwater.depth.mul(-DARKENING_PER_DEPTH)).mul(skyUniforms.ambient);

  const water = lit.add(scattered).mul(light);
  // The beams are in the water as the background shows it; not in the fog that hides the hull in it
  return withRays ? water.add(sunRays(direction, withSun)) : water;
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

export function surfaceFromBelow(normal: Node<"vec3">, viewDirection: Node<"vec3">, sunVisibility: Node<"float">) {
  const inWindow = snellWindow(normal, viewDirection);
  const sky = gammaLift(
    clearSkyColor(viewDirection, overcast(), vec3(skyUniforms.zenith), vec3(skyUniforms.horizon), skyUniforms.dim)
  ).mul(SNELL_WINDOW_TRANSMISSION);
  const reflected = underwaterColor(viewDirection.mul(vec3(1.0, -1.0, 1.0)));

  // The sun through the surface: its light, bent down by each wave's tilt
  const sun = vec3(SUN);
  const bentSun = normalize(sun.add(normal.sub(vec3(0.0, 1.0, 0.0)).mul(SUN_BENDING)));
  const towardsBentSun = viewDirection.dot(bentSun);
  const sunSpot = smoothstep(SUN_DISC_EDGE, SUN_DISC_FULL, towardsBentSun)
    .mul(SUN_SPOT_BRIGHTNESS)
    .add(pow(max(towardsBentSun, 0.0), SUN_HALO_POWER).mul(SUN_HALO_STRENGTH))
    .mul(sunVisibility);

  return mix(reflected, sky, inWindow).add(vec3(sunSpot).mul(vec3(skyUniforms.sunColor)));
}
