/**
 * Seascape — 20. Weather
 *
 * The weather, as three amounts from 0 to 1 that mix freely:
 * - `cloudCover`: from a few fair-weather puffs to a sky fully overcast;
 * - `rain`: from none to a downpour;
 * - `snow`: from none to heavy snow.
 *
 * Everything the weather touches reads it from here: the clouds, the sky and
 * the haze (`seascape-atmosphere-tsl.ts`), the sunlight on the ship and on the
 * water, the rain and snow falling round the camera
 * (`seascape-precipitation.ts`), the rain's rings on the water.
 *
 * Whatever real weather data turns out to look like — cloud cover in per
 * cent, precipitation in mm/h, a temperature, a weather code — it maps onto
 * these three in one place, `setWeather`.
 */
import { clamp, float, max, uniform } from "three/tsl";

/** The weather, each from 0 to 1. */
export type Weather = {
  cloudCover: number;
  rain: number;
  snow: number;
};

/** A clear day: what the scene starts with. */
export const CLEAR_WEATHER: Weather = { cloudCover: 0.15, rain: 0, snow: 0 };

/**
 * How much of the sun gets through at full cloud cover: an overcast sky lets
 * through about a fifth of the direct light, and none of it as a sharp glint.
 */
const OVERCAST_SUNLIGHT = 0.18;
/** Cloud cover from which the sun starts to dim, and at which it is dimmest. */
const SUN_DIMS_FROM = 0.4;
const SUN_DIMMEST_AT = 0.9;

/** The shaders' view of the weather: uniforms, written by `setWeather`. */
export const weather = {
  cloudCover: uniform(CLEAR_WEATHER.cloudCover),
  rain: uniform(CLEAR_WEATHER.rain),
  snow: uniform(CLEAR_WEATHER.snow),
  /** How much direct sunlight reaches the sea, from 0 to 1. */
  sunlight: uniform(1),
};

/**
 * The wind round the ship as it feels it, in m/s on the scene's x and z: the
 * true wind plus the ship's own way through the air. Written by the sea's
 * component each frame, read by the rain and snow.
 */
export const apparentWind = { x: 0, z: 0 };

/** The weather as the CPU last set it: for the lights, which are not shaders. */
export const weatherState = { ...CLEAR_WEATHER, sunlight: 1 };

/** How much direct sunlight a cloud cover lets through, from 0 to 1. */
function sunlightThrough(cloudCover: number) {
  const t = Math.min(Math.max((cloudCover - SUN_DIMS_FROM) / (SUN_DIMMEST_AT - SUN_DIMS_FROM), 0), 1);
  const eased = t * t * (3 - 2 * t);

  return 1 - (1 - OVERCAST_SUNLIGHT) * eased;
}

/** Sets the weather: each amount from 0 to 1. Rain and snow bring clouds with them. */
export function setWeather({ cloudCover, rain, snow }: Weather) {
  const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1);
  // It does not rain or snow from a clear sky: the precipitation raises the cover
  const cover = Math.max(clampUnit(cloudCover), clampUnit(rain) * 0.9, clampUnit(snow) * 0.85);
  const sunlight = sunlightThrough(cover);

  weather.cloudCover.value = cover;
  weather.rain.value = clampUnit(rain);
  weather.snow.value = clampUnit(snow);
  weather.sunlight.value = sunlight;
  Object.assign(weatherState, { cloudCover: cover, rain: clampUnit(rain), snow: clampUnit(snow), sunlight });
}

/** How grey the day is, from 0 (clear) to 1 (overcast): for colours that follow the clouds. */
export function overcast() {
  return clamp(weather.cloudCover.sub(0.3).div(0.6), 0.0, 1.0);
}

/** How wet or snowy the air is, 0 to 1: for the haze, which closes in with them. */
export function precipitation() {
  return max(weather.rain, weather.snow.mul(float(1.2))).min(1.0);
}
