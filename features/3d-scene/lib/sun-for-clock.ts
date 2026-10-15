import { DEFAULT_SKY_PLACE } from "./sky-controls-store";
import { solarPosition, type SolarPosition } from "./solar-position";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The sun's twilight stages, by its height in degrees: the horizon, civil twilight's end, nautical's. */
const SUNRISE_DEG = 0;
const CIVIL_TWILIGHT_DEG = -6;
const NAUTICAL_TWILIGHT_DEG = -12;
/** Below this the sun is low: sunrise or sunset's hour. */
const GOLDEN_HOUR_DEG = 6;

/**
 * Where the sun is for a clock: the data's moment (the time now without
 * data), at the hour of the day the user set instead if they did, at the
 * ship's place (the North Sea's without a position).
 *
 * @param observedAt  the data's own clock, ms since the epoch; null without data
 * @param hourUtc     the user's hour of the day, 0 to 24; null to follow the clock
 */
export function sunForClock(
  observedAt: number | null,
  hourUtc: number | null,
  position: { latitude: number; longitude: number } | null
): SolarPosition {
  const clock = observedAt ?? Date.now();
  const startOfDay = clock - (((clock % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
  const moment = hourUtc === null ? clock : startOfDay + hourUtc * MS_PER_HOUR;
  const place = position ?? DEFAULT_SKY_PLACE;

  return solarPosition(moment, place.latitude, place.longitude);
}

/** What the sun's height makes of the hour, in a word. */
export function describeSunHeight(elevationDeg: number) {
  if (elevationDeg > GOLDEN_HOUR_DEG) return "day";
  if (elevationDeg > SUNRISE_DEG) return "sun on the horizon";
  if (elevationDeg > CIVIL_TWILIGHT_DEG) return "twilight";
  if (elevationDeg > NAUTICAL_TWILIGHT_DEG) return "dusk";
  return "night";
}
