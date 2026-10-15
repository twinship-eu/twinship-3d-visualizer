/**
 * The sky as the time of day makes it.
 *
 * One place says where the sun is and what the day looks like — the sky, the
 * sea, the underwater, the lights and the baked environment all read it, so the
 * sunset is the same one everywhere. It is written by `setSun` from the sun's
 * height and its bearing off the bow, which the data gives (`solar-position.ts`
 * and the ship's heading); the shaders read the uniforms, the lights the
 * plain `skyState`.
 */
import { uniform } from "three/tsl";
import { Color, MathUtils, Vector3 } from "three/webgpu";
import { ONTOLOGY_DEFAULT_HOUR_UTC } from "./sky-controls-store";
import { sunForClock } from "./sun-for-clock";

const RADIANS_PER_DEGREE = Math.PI / 180;

/** The sun's height, degrees, at which each stage of the day is reached. */
const NIGHT_UNTIL_DEG = -12;
const TWILIGHT_PEAK_DEG = -2;
const DAY_FROM_DEG = 10;
/** The sun's light begins at this height and is full by the second. */
const SUNLIGHT_FROM_DEG = -2;
const SUNLIGHT_FULL_DEG = 25;
/** How much light a low sun gives against a high one: it is weaker, and photographed so. */
const LOW_SUN_LIGHT = 0.6;
/** The directional light is not let lower than this — a shadow along the water is no shadow. */
export const MIN_SHADOW_ELEVATION_DEG = 12;
/**
 * The probe the ship's metal reflects is baked with the sun no lower than
 * this: below the horizon the physical sky is black, and so was the ship. Its
 * strength follows the hour instead (`environmentLevel`).
 */
const MIN_PROBE_SUN_DEG = 6;
/**
 * Moonlight, so the ship can be watched at night: a cool light, a fraction of
 * the sun's, strongest when the sun is well down. Not the moon's real phase or
 * place — an instrument has to be readable at any hour.
 */
const MOON_COLOR = new Color(0.55, 0.68, 1.0);
const MOON_STRENGTH = 0.38;
/** The share of its daylight strength the probe keeps at night: the sky's and the stars' light. */
const NIGHT_PROBE_LEVEL = 0.8;
/** What the water, the ship and the underwater keep of their light at night: the stars' and the sky's. */
const NIGHT_AMBIENT = 0.09;
/** The sun's height at which the water has all its day light. */
const FULL_AMBIENT_DEG = 24;

/** The sky's colours at night, in twilight, by day: straight up, and at the horizon. */
const NIGHT_ZENITH = new Color(0.004, 0.007, 0.02);
const NIGHT_HORIZON = new Color(0.012, 0.02, 0.045);
const TWILIGHT_ZENITH = new Color(0.04, 0.07, 0.19);
const TWILIGHT_HORIZON = new Color(0.28, 0.24, 0.34);
const DAY_ZENITH = new Color(0.16, 0.38, 0.75);
const DAY_HORIZON = new Color(0.62, 0.76, 0.9);
/** The sun's light low on the horizon, and high. */
const LOW_SUN = new Color(1.0, 0.5, 0.2);
const HIGH_SUN = new Color(1.0, 0.96, 0.88);
/** The glow of the sky at the sun's side of the horizon at dusk and dawn. */
const GLOW = new Color(1.0, 0.42, 0.16);
/** Clouds lit by night, by a sunset, by day. */
const NIGHT_CLOUD = new Color(0.03, 0.035, 0.06);
const TWILIGHT_CLOUD = new Color(1.0, 0.55, 0.45);
const DAY_CLOUD = new Color(1.0, 1.0, 1.0);

const smooth = (from: number, to: number, value: number) => {
  const t = MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** What the shaders read. Plain uniforms, written by `setSun`. */
export const skyUniforms = {
  /** Towards the sun, in the ship's frame. */
  sunDirection: uniform(new Vector3(0, 1, 0)),
  /** The sun's light: its colour, scaled by how strong it is (0 at night). */
  sunColor: uniform(new Color(1, 1, 1)),
  /** The sky straight up, and at the horizon, before the clouds. */
  zenith: uniform(new Color(DAY_ZENITH)),
  horizon: uniform(new Color(DAY_HORIZON)),
  /** What the overcast greys keep of their light: 1 by day. */
  dim: uniform(1),
  /** What the water and the air keep of their light, 0 to 1: the night's little. */
  ambient: uniform(1),
  /** How much the horizon glows at dusk and dawn, 0 to 1, and in what colour. */
  glow: uniform(0),
  glowColor: uniform(new Color(GLOW)),
  /** The colour clouds are lit with. */
  cloudLight: uniform(new Color(DAY_CLOUD)),
  /** How visible the stars are, 0 to 1. */
  stars: uniform(0),
  /** The ship's heading, radians: the stars turn with the sky. */
  turn: uniform(0),
};

/** What the lights read: the same state, on the CPU. */
export const skyState = {
  elevationDeg: 58,
  sunDirection: new Vector3(0, 1, 0),
  /** The directional light's direction: the sun, kept off the horizon. */
  lightDirection: new Vector3(0, 1, 0),
  /** The light's colour and its strength against a high sun, 0 to 1. */
  sunColor: new Color(1, 1, 1),
  sunStrength: 1,
  /** What the directional light shines with: the sun's, or at night the moon's. */
  lightColor: new Color(1, 1, 1),
  lightStrength: 1,
  /** 0 at night, 1 by day. */
  daylight: 1,
  /** What ambient light is left: `NIGHT_AMBIENT` to 1. */
  ambient: 1,
  /** How strong the lighting probe is against its daylight strength: `NIGHT_PROBE_LEVEL` to 1. */
  environmentLevel: 1,
};

/** Towards the sun for baking the probe: kept off the horizon, see `MIN_PROBE_SUN_DEG`. */
export function probeSunDirection(target = new Vector3()) {
  const { sunDirection, elevationDeg } = skyState;
  if (elevationDeg >= MIN_PROBE_SUN_DEG) return target.copy(sunDirection);
  const elevation = MIN_PROBE_SUN_DEG * RADIANS_PER_DEGREE;
  const horizontal = Math.hypot(sunDirection.x, sunDirection.z) || 1;
  return target.set(
    (sunDirection.x / horizontal) * Math.cos(elevation),
    Math.sin(elevation),
    (sunDirection.z / horizontal) * Math.cos(elevation)
  );
}

/**
 * Puts the sun in the sky.
 *
 * @param elevationDeg    its height above the horizon, negative below it
 * @param relativeBearingDeg where it is off the bow, clockwise: its compass
 *                        bearing less the ship's heading
 * @param headingDeg      the ship's heading, for the stars
 */
export function setSun(elevationDeg: number, relativeBearingDeg: number, headingDeg = 0) {
  const elevation = elevationDeg * RADIANS_PER_DEGREE;
  // The bow is +z and the starboard side -x: a bearing clockwise turns from +z towards -x
  const bearing = relativeBearingDeg * RADIANS_PER_DEGREE;
  const sunDirection = new Vector3(-Math.sin(bearing) * Math.cos(elevation), Math.sin(elevation), Math.cos(bearing) * Math.cos(elevation));

  const day = smooth(NIGHT_UNTIL_DEG + 6, DAY_FROM_DEG, elevationDeg);
  // The stretch of dusk and dawn: rises from night, peaks near the horizon, is gone by day
  const dusk = smooth(NIGHT_UNTIL_DEG, TWILIGHT_PEAK_DEG, elevationDeg) * (1 - smooth(TWILIGHT_PEAK_DEG + 2, DAY_FROM_DEG + 6, elevationDeg));
  const lowSun = 1 - smooth(2, 28, elevationDeg);
  const sunStrength =
    smooth(SUNLIGHT_FROM_DEG, 3, elevationDeg) * (LOW_SUN_LIGHT + (1 - LOW_SUN_LIGHT) * smooth(0, SUNLIGHT_FULL_DEG, elevationDeg));
  // The water and the air keep their light longer than the sky's colour: a low sun lights the sea less than noon does
  const ambient = NIGHT_AMBIENT + (1 - NIGHT_AMBIENT) * smooth(NIGHT_UNTIL_DEG, FULL_AMBIENT_DEG, elevationDeg);

  const sunColor = new Color().lerpColors(HIGH_SUN, LOW_SUN, lowSun);
  const zenith = new Color().lerpColors(NIGHT_ZENITH, TWILIGHT_ZENITH, smooth(NIGHT_UNTIL_DEG, TWILIGHT_PEAK_DEG, elevationDeg));
  zenith.lerp(DAY_ZENITH, day);
  const horizon = new Color().lerpColors(NIGHT_HORIZON, TWILIGHT_HORIZON, smooth(NIGHT_UNTIL_DEG, TWILIGHT_PEAK_DEG, elevationDeg));
  horizon.lerp(DAY_HORIZON, day);
  const cloudLight = new Color().lerpColors(NIGHT_CLOUD, TWILIGHT_CLOUD, smooth(NIGHT_UNTIL_DEG, TWILIGHT_PEAK_DEG, elevationDeg));
  cloudLight.lerp(DAY_CLOUD, smooth(TWILIGHT_PEAK_DEG + 2, DAY_FROM_DEG + 6, elevationDeg));

  skyUniforms.sunDirection.value.copy(sunDirection);
  skyUniforms.sunColor.value.copy(sunColor).multiplyScalar(sunStrength);
  skyUniforms.zenith.value.copy(zenith);
  skyUniforms.horizon.value.copy(horizon);
  skyUniforms.dim.value = ambient;
  skyUniforms.ambient.value = ambient;
  skyUniforms.glow.value = dusk;
  skyUniforms.cloudLight.value.copy(cloudLight);
  skyUniforms.stars.value = 1 - smooth(NIGHT_UNTIL_DEG, TWILIGHT_PEAK_DEG + 6, elevationDeg);
  skyUniforms.turn.value = headingDeg * RADIANS_PER_DEGREE;

  const lightElevation = Math.max(elevationDeg, MIN_SHADOW_ELEVATION_DEG) * RADIANS_PER_DEGREE;
  const horizontal = Math.hypot(sunDirection.x, sunDirection.z) || 1;
  skyState.elevationDeg = elevationDeg;
  skyState.sunDirection.copy(sunDirection);
  skyState.lightDirection.set(
    (sunDirection.x / horizontal) * Math.cos(lightElevation),
    Math.sin(lightElevation),
    (sunDirection.z / horizontal) * Math.cos(lightElevation)
  );
  skyState.sunColor.copy(sunColor);
  skyState.sunStrength = sunStrength;
  const moon = MOON_STRENGTH * (1 - smooth(-6, 2, elevationDeg));
  skyState.lightStrength = Math.max(sunStrength, moon);
  skyState.lightColor.lerpColors(sunColor, MOON_COLOR, moon / (moon + sunStrength + 1e-6));
  skyState.daylight = day;
  skyState.ambient = ambient;
  skyState.environmentLevel = NIGHT_PROBE_LEVEL + (1 - NIGHT_PROBE_LEVEL) * smooth(NIGHT_UNTIL_DEG, DAY_FROM_DEG, elevationDeg);
}

/**
 * Until the data says otherwise: the Ontology's own hour at the default place
 * (see `sky-controls-store.ts`), the ship's heading north — so the page opens
 * on the sun it settles on, and the sky does not move as the first data comes.
 */
const START = sunForClock(null, ONTOLOGY_DEFAULT_HOUR_UTC, null);
export const DEFAULT_SUN = { elevationDeg: START.elevationDeg, relativeBearingDeg: START.azimuthDeg } as const;
setSun(DEFAULT_SUN.elevationDeg, DEFAULT_SUN.relativeBearingDeg);
