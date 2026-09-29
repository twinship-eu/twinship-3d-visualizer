import { RECORDED_SENSORS, RECORDING_COLUMNS as COLUMNS } from "../live-data-recording-config";
import { turnBetween, type RecordingReader } from "./recording";
import type { LiveSnapshot } from "../live-data-types";

const KG_PER_TONNE = 1000;
const KW_PER_MW = 1000;

type Pair = readonly [string, string];

/**
 * The simulated snapshot with the recording's readings in it, wherever the
 * recording has them: what it does not record stays simulated.
 *
 * Roll, pitch, heave and the sea's wave height stay the scene's: the scene
 * raises its sea from the recorded wind and rides the ship on it, and the
 * instruments show the ship as it is seen.
 */
export function withRecordedReadings(snapshot: LiveSnapshot, read: RecordingReader): LiveSnapshot {
  const or = (column: string, fallback: number) => read.number(column) ?? fallback;
  const each = ([first, second]: Pair) => [read.number(first), read.number(second)] as const;
  /** A pair's readings recorded: combined, or the fallback when neither is. */
  const combine = (pair: Pair, fallback: number, combined: (readings: number[]) => number) => {
    const found = each(pair).filter((reading) => reading !== undefined);
    return found.length ? combined(found) : fallback;
  };
  const total = (readings: number[]) => readings.reduce((sum, reading) => sum + reading, 0);
  const sum = (pair: Pair, fallback: number) => combine(pair, fallback, total);
  const mean = (pair: Pair, fallback: number) => combine(pair, fallback, (readings) => total(readings) / readings.length);
  const highest = (pair: Pair, fallback: number) => combine(pair, fallback, (readings) => Math.max(...readings));

  const { navigation, systems, voyage } = snapshot;
  const latitude = read.number(COLUMNS.latitude);
  const longitude = read.number(COLUMNS.longitude);
  const headingDeg = read.bearing(COLUMNS.heading) ?? navigation.headingDeg;
  const courseOverGroundDeg = read.bearing(COLUMNS.courseOverGround) ?? navigation.courseOverGroundDeg;
  const draftForeM = or(COLUMNS.draftFore, systems.hull.draftForeM);
  const draftAftM = or(COLUMNS.draftAft, systems.hull.draftAftM);
  const [fan1, fan2] = each(COLUMNS.sailFanSpeed);
  const fuelKgPerHour = sum(COLUMNS.gensetFuel, systems.energy.fuelTph * KG_PER_TONNE);
  const recordedSensors = Object.entries(RECORDED_SENSORS).flatMap(([sensorId, column]) => {
    const reading = read.number(column);
    return reading === undefined ? [] : [[sensorId, reading] as const];
  });

  return {
    ...snapshot,
    origin: "recorded",
    autonomyLevel: read.text(COLUMNS.autonomyLevel) ?? snapshot.autonomyLevel,
    navigation: {
      ...navigation,
      headingDeg,
      courseOverGroundDeg,
      speedOverGroundKn: or(COLUMNS.speedOverGround, navigation.speedOverGroundKn),
      speedThroughWaterKn: or(COLUMNS.speedThroughWater, navigation.speedThroughWaterKn),
      rateOfTurnDegPerMin: or(COLUMNS.rateOfTurn, navigation.rateOfTurnDegPerMin),
      trueWind: {
        speedKn: or(COLUMNS.trueWindSpeed, navigation.trueWind.speedKn),
        fromDeg: read.bearing(COLUMNS.trueWindFrom) ?? navigation.trueWind.fromDeg,
      },
      rudderDeg: mean(COLUMNS.rudder, navigation.rudderDeg),
      driftDeg: turnBetween(headingDeg, courseOverGroundDeg),
      position: latitude !== undefined && longitude !== undefined ? { latitude, longitude } : navigation.position,
    },
    voyage: { ...voyage, distanceToGoNm: or(COLUMNS.distanceToGo, voyage.distanceToGoNm) },
    systems: {
      ...systems,
      propulsion: {
        ...systems.propulsion,
        shaftRpm: mean(COLUMNS.shaftSpeed, systems.propulsion.shaftRpm),
        powerMw: sum(COLUMNS.shaftPower, systems.propulsion.powerMw * KW_PER_MW) / KW_PER_MW,
        pitchPct: mean(COLUMNS.propellerPitch, systems.propulsion.pitchPct),
      },
      energy: {
        ...systems.energy,
        fuelTph: fuelKgPerHour / KG_PER_TONNE,
        engineLoadPct: mean(COLUMNS.gensetLoad, systems.energy.engineLoadPct),
        engineRpm: mean(COLUMNS.gensetSpeed, systems.energy.engineRpm),
        exhaustTempC: highest(COLUMNS.gensetExhaust, systems.energy.exhaustTempC),
        coolantTempC: highest(COLUMNS.gensetCoolant, systems.energy.coolantTempC),
        batteryPct: or(COLUMNS.batteryCharge, systems.energy.batteryPct),
      },
      windAssist: {
        thrustKn: sum(COLUMNS.sailThrust, systems.windAssist.thrustKn),
        fuelSavingPct: sum(COLUMNS.sailSaving, systems.windAssist.fuelSavingPct),
        rotorRpm: [fan1 ?? systems.windAssist.rotorRpm[0], fan2 ?? systems.windAssist.rotorRpm[1]],
      },
      hull: {
        ...systems.hull,
        draftForeM,
        draftAftM,
        meanDraftM: (draftForeM + draftAftM) / 2,
        trimM: draftAftM - draftForeM,
      },
    },
    sensors: { ...snapshot.sensors, ...Object.fromEntries(recordedSensors) },
  };
}
