/**
 * Where the sun is in the sky of a place at a moment: its bearing from true
 * north (clockwise) and its height above the horizon, in degrees.
 *
 * The NOAA Solar Calculator's method (Meeus, Astronomical Algorithms): the sun
 * to within a hundredth of a degree for the next centuries, atmospheric
 * refraction included. It is what makes the sky follow the data — the ship's
 * position and the data's own clock — and, with the ship's heading, where the
 * sun is off the bow.
 */

export type SolarPosition = {
  /** Bearing of the sun from true north, clockwise, 0-360. */
  azimuthDeg: number;
  /** Height above the horizon, refraction included: negative below it. */
  elevationDeg: number;
};

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const J2000_JULIAN_DAY = 2_451_545;
const DAYS_PER_CENTURY = 36_525;
const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;
const DEGREES_PER_HOUR_ANGLE_MINUTE = 4;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const wrap = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

/**
 * Atmospheric refraction, in degrees, for a geometric elevation: it lifts the
 * sun about half a degree at the horizon, so the sun is seen to rise a little
 * before its centre geometrically does (NOAA's piecewise fit).
 */
function refractionDeg(elevationDeg: number) {
  if (elevationDeg > 85) return 0;
  const tangent = Math.tan(rad(elevationDeg));
  let arcSeconds: number;
  if (elevationDeg > 5) {
    arcSeconds = 58.1 / tangent - 0.07 / tangent ** 3 + 0.000086 / tangent ** 5;
  } else if (elevationDeg > -0.575) {
    arcSeconds =
      1735 + elevationDeg * (-518.2 + elevationDeg * (103.4 + elevationDeg * (-12.79 + elevationDeg * 0.711)));
  } else {
    arcSeconds = -20.774 / tangent;
  }
  return arcSeconds / 3600;
}

/**
 * @param timeMs        the moment, ms since the Unix epoch (UTC)
 * @param latitudeDeg   north positive
 * @param longitudeDeg  east positive
 */
export function solarPosition(timeMs: number, latitudeDeg: number, longitudeDeg: number): SolarPosition {
  const julianDay = timeMs / MS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
  const t = (julianDay - J2000_JULIAN_DAY) / DAYS_PER_CENTURY;

  // The sun's place on the ecliptic
  const meanLongitude = wrap(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const anomaly = rad(meanAnomaly);
  const equationOfCentre =
    Math.sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * anomaly) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * anomaly) * 0.000289;
  const trueLongitude = meanLongitude + equationOfCentre;
  const node = rad(125.04 - 1934.136 * t);
  const apparentLongitude = rad(trueLongitude - 0.00569 - 0.00478 * Math.sin(node));

  // The tilt of the earth's axis, and the sun's declination from it
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = rad(meanObliquity + 0.00256 * Math.cos(node));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));

  // The equation of time, in minutes: how far the sun runs ahead of the clock
  const y = Math.tan(obliquity / 2) ** 2;
  const longitude2 = 2 * rad(meanLongitude);
  const equationOfTime =
    DEGREES_PER_HOUR_ANGLE_MINUTE *
    deg(
      y * Math.sin(longitude2) -
        2 * eccentricity * Math.sin(anomaly) +
        4 * eccentricity * y * Math.sin(anomaly) * Math.cos(longitude2) -
        0.5 * y * y * Math.sin(2 * longitude2) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly)
    );

  // The hour angle: the sun's distance west of the meridian
  const minutesUtc = wrap(timeMs, MS_PER_DAY) / MS_PER_MINUTE;
  const solarMinutes = wrap(minutesUtc + equationOfTime + DEGREES_PER_HOUR_ANGLE_MINUTE * longitudeDeg, MINUTES_PER_DAY);
  const hourAngle = rad(solarMinutes / DEGREES_PER_HOUR_ANGLE_MINUTE - 180);

  const latitude = rad(latitudeDeg);
  const cosZenith = Math.min(
    1,
    Math.max(-1, Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle))
  );
  const zenith = Math.acos(cosZenith);
  const geometricElevation = 90 - deg(zenith);

  // Bearing from north: from the sun's height and declination, mirrored for the afternoon
  const sinZenith = Math.sin(zenith);
  const fromNorth =
    sinZenith < 1e-9
      ? 0
      : deg(
          Math.acos(
            Math.min(1, Math.max(-1, (Math.sin(latitude) * cosZenith - Math.sin(declination)) / (Math.cos(latitude) * sinZenith)))
          )
        );
  const azimuthDeg = hourAngle > 0 ? wrap(fromNorth + 180, 360) : wrap(540 - fromNorth, 360);

  return { azimuthDeg, elevationDeg: geometricElevation + refractionDeg(geometricElevation) };
}
