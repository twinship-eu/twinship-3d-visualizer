import type { GeoPosition } from "../live-data-types";

/** A bearing as a bridge reads it: three digits, "087°". */
export function formatBearing(degrees: number) {
  const rounded = Math.round(degrees) % 360;
  return `${String(rounded).padStart(3, "0")}°`;
}

/** A speed in knots, to a tenth: "11.4 kn". */
export function formatKnots(knots: number) {
  return `${knots.toFixed(1)} kn`;
}

const MINUTES_PER_DEGREE = 60;

/** One coordinate in degrees and decimal minutes: "56°07.2′N". */
function formatCoordinate(value: number, positive: string, negative: string, degreeDigits: number) {
  const hemisphere = value >= 0 ? positive : negative;
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * MINUTES_PER_DEGREE;

  return `${String(degrees).padStart(degreeDigits, "0")}°${minutes.toFixed(1).padStart(4, "0")}′${hemisphere}`;
}

/** A position as a chart gives it: "56°07.2′N 007°27.0′E". */
export function formatPosition(position: GeoPosition) {
  return `${formatCoordinate(position.latitude, "N", "S", 2)} ${formatCoordinate(position.longitude, "E", "W", 3)}`;
}

/** A moment's time of day in UTC, to the second: "15:57:56". */
export function formatUtcTime(timestamp: number) {
  return new Date(timestamp).toISOString().slice(11, 19);
}

const SECONDS_PER_MINUTE = 60;

/** How long since a moment, as minutes and seconds: "02:15". */
export function formatElapsed(since: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}
