import type { LiveSnapshot, NavigationState, VoyageState, Waypoint } from "@/features/live-data/live-data-types";

const RADIANS_PER_DEGREE = Math.PI / 180;
const KILOGRAMS_PER_TONNE = 1000;
/** Below this speed, knots, the ship makes no way: no ETA, no fuel per mile. */
const MIN_WAY_KN = 0.5;

/** An angle brought into -180…180 degrees. */
export function wrapSigned(degrees: number) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/**
 * The wind as the ship feels it: the true wind less the ship's own way.
 * Its speed in knots, and the angle it comes from off the bow, degrees,
 * starboard positive.
 */
export function relativeWind(navigation: NavigationState) {
  const { trueWind, headingDeg, speedOverGroundKn } = navigation;
  // Velocities, east and north: the air's, towards where it blows, and the ship's
  const blowsTowards = (trueWind.fromDeg + 180) * RADIANS_PER_DEGREE;
  const airEast = trueWind.speedKn * Math.sin(blowsTowards);
  const airNorth = trueWind.speedKn * Math.cos(blowsTowards);
  const heading = headingDeg * RADIANS_PER_DEGREE;
  const feltEast = airEast - speedOverGroundKn * Math.sin(heading);
  const feltNorth = airNorth - speedOverGroundKn * Math.cos(heading);
  const comesFrom = Math.atan2(-feltEast, -feltNorth) / RADIANS_PER_DEGREE;

  return { speedKn: Math.hypot(feltEast, feltNorth), angleDeg: wrapSigned(comesFrom - headingDeg) };
}

/** Hours to go at the speed now; null when the ship makes no way. */
export function etaHours(voyage: VoyageState, speedKn: number) {
  return speedKn > MIN_WAY_KN ? voyage.distanceToGoNm / speedKn : null;
}

/** "15 h 57 m", from hours. */
export function formatHours(hours: number | null) {
  if (hours === null) return "—";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} m`;
}

/** How far along the route the ship is, nautical miles. */
export function distanceMadeGood(voyage: VoyageState) {
  return voyage.totalNm - voyage.distanceToGoNm;
}

/** The next waypoint ahead, and how far it is, nautical miles; null past the last one. */
export function nextWaypoint(voyage: VoyageState): { waypoint: Waypoint; distanceNm: number } | null {
  const along = distanceMadeGood(voyage);
  const waypoint = voyage.waypoints.find((candidate) => candidate.atNm > along);
  return waypoint ? { waypoint, distanceNm: waypoint.atNm - along } : null;
}

/** Fuel burnt per nautical mile made good, kg; null when the ship makes no way. */
export function fuelPerMileKg(snapshot: LiveSnapshot) {
  const speed = snapshot.navigation.speedOverGroundKn;
  return speed > MIN_WAY_KN ? (snapshot.systems.energy.fuelTph * KILOGRAMS_PER_TONNE) / speed : null;
}

/** The current setting against the ship: speed over ground less speed through the water, knots. */
export function currentKn(navigation: NavigationState) {
  return navigation.speedOverGroundKn - navigation.speedThroughWaterKn;
}
