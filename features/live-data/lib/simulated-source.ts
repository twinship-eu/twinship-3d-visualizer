import {
  METRES_PER_DEGREE_LATITUDE,
  METRES_PER_NAUTICAL_MILE,
  SECONDS_PER_HOUR,
  SIMULATED_AUTONOMY_LEVEL,
  SIMULATED_BRIDGE,
  SIMULATED_CRANE_STATE,
  SIMULATED_VOYAGE,
  SIMULATED_WAVE_HEIGHT,
  SIMULATION_SYSTEMS_BASELINE,
  SIMULATION_BASELINE,
  SIMULATION_PULL,
  SIMULATION_RATE_HZ,
  SIMULATION_START_POSITION,
} from "../live-data-config";
import { createMockAlarms } from "../live-data-mock";
import { SENSORS } from "../live-data-sensors";
import { shipMotion } from "@/features/3d-scene/lib/seascape-ship-motion";
import { sceneSeaState } from "@/features/3d-scene/lib/live-scene-overrides";
import type { Alarm, GeoPosition, LiveDataSource, LiveSnapshot, ShipSystems } from "../live-data-types";

type Drifting = { value: number; spread: number };

/** The simulated ship's readings as they drift. */
type SimulatedState = {
  heading: number;
  courseOffset: number;
  speedOverGround: number;
  speedThroughWater: number;
  rateOfTurn: number;
  windSpeed: number;
  windFrom: number;
  rudder: number;
  crossTrackError: number;
  distanceToGo: number;
  position: GeoPosition;
};

type SystemsReading = keyof typeof SIMULATION_SYSTEMS_BASELINE;

/** A little apart, so the two fans do not read the same. */
const FAN_OFFSET_RPM = 5;

const DEGREES_PER_RADIAN = 180 / Math.PI;
/** Share of the heave's peak kept each tick: the amplitude reported fades over some tens of seconds. */
const HEAVE_PEAK_KEPT = 0.96;

/**
 * The ship's attitude as the scene has it — how it rides the waves the wind
 * raised there: what the simulation reports, so the instruments and the ship
 * seen agree. Roll starboard down positive, pitch bow up positive.
 */
function attitudeFromScene() {
  return { rollDeg: shipMotion.roll * DEGREES_PER_RADIAN, pitchDeg: -shipMotion.pitch * DEGREES_PER_RADIAN };
}

/** Sensors fitted per component, from the catalogue. */
const SENSOR_COUNTS = SENSORS.reduce<Record<string, number>>((counts, sensor) => {
  counts[sensor.componentLabel] = (counts[sensor.componentLabel] ?? 0) + 1;
  return counts;
}, {});

/** One step of a bounded random walk: a nudge, pulled back towards the baseline. */
function drift(current: number, { value, spread }: Drifting) {
  const nudge = (Math.random() * 2 - 1) * spread * 0.5;
  return current + nudge + (value - current) * SIMULATION_PULL;
}

const wrapDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

/** The ship moved on `seconds` along `courseDeg` at `speedKn`. */
function sail(position: GeoPosition, courseDeg: number, speedKn: number, seconds: number): GeoPosition {
  const metres = (speedKn * METRES_PER_NAUTICAL_MILE * seconds) / SECONDS_PER_HOUR;
  const course = (courseDeg * Math.PI) / 180;
  const northMetres = metres * Math.cos(course);
  const eastMetres = metres * Math.sin(course);
  const metresPerDegreeLongitude = METRES_PER_DEGREE_LATITUDE * Math.cos((position.latitude * Math.PI) / 180);

  return {
    latitude: position.latitude + northMetres / METRES_PER_DEGREE_LATITUDE,
    longitude: position.longitude + eastMetres / metresPerDegreeLongitude,
  };
}

/**
 * A simulated ship: the design's sample values, drifting, at SIMULATION_RATE_HZ.
 * Stands in for the real stream until it is connected.
 */
export function createSimulatedSource(): LiveDataSource {
  const base = SIMULATION_BASELINE;
  /** The log, shared with `acknowledgeAlarm`: filled when the simulation starts. */
  let alarms: Alarm[] = [];

  function acknowledgeAlarm(alarmId: string) {
    alarms = alarms.map((alarm) => (alarm.id === alarmId ? { ...alarm, isAcknowledged: true } : alarm));
  }

  function start(onSnapshot: (snapshot: LiveSnapshot) => void) {
    const startedAt = Date.now();
    alarms = createMockAlarms(startedAt);
    const sensors = Object.fromEntries(SENSORS.map((sensor) => [sensor.id, sensor.simulated.value]));
    let waveHeight: number = SIMULATED_WAVE_HEIGHT.value;
    let heavePeak = 0;
    const state: SimulatedState = {
      heading: base.headingDeg.value,
      courseOffset: base.courseOffsetDeg.value,
      speedOverGround: base.speedOverGroundKn.value,
      speedThroughWater: base.speedThroughWaterKn.value,
      rateOfTurn: base.rateOfTurnDegPerMin.value,
      windSpeed: base.trueWindSpeedKn.value,
      windFrom: base.trueWindFromDeg.value,
      rudder: base.rudderDeg.value,
      crossTrackError: base.crossTrackErrorNm.value,
      distanceToGo: SIMULATED_VOYAGE.distanceToGoNm,
      position: { ...SIMULATION_START_POSITION },
    };
    const readings = Object.fromEntries(
      Object.entries(SIMULATION_SYSTEMS_BASELINE).map(([name, { value }]) => [name, value])
    ) as Record<SystemsReading, number>;
    const fans: [number, number] = [
      SIMULATION_SYSTEMS_BASELINE.fanRpm.value + FAN_OFFSET_RPM,
      SIMULATION_SYSTEMS_BASELINE.fanRpm.value - FAN_OFFSET_RPM,
    ];
    const intervalSeconds = 1 / SIMULATION_RATE_HZ;

    function systemsNow(): ShipSystems {
      for (const name of Object.keys(readings) as SystemsReading[]) {
        readings[name] = drift(readings[name], SIMULATION_SYSTEMS_BASELINE[name]);
      }
      const fanBaseline = SIMULATION_SYSTEMS_BASELINE.fanRpm;
      fans[0] = drift(fans[0], { value: fanBaseline.value + FAN_OFFSET_RPM, spread: fanBaseline.spread });
      fans[1] = drift(fans[1], { value: fanBaseline.value - FAN_OFFSET_RPM, spread: fanBaseline.spread });

      return {
        propulsion: {
          shaftRpm: readings.shaftRpm,
          powerMw: readings.shaftPowerMw,
          pitchPct: readings.pitchPct,
          slipPct: readings.slipPct,
        },
        energy: {
          fuelTph: readings.fuelTph,
          engineLoadPct: readings.engineLoadPct,
          engineRpm: readings.engineRpm,
          exhaustTempC: readings.exhaustTempC,
          coolantTempC: readings.coolantTempC,
          batteryPct: readings.batteryPct,
        },
        windAssist: {
          thrustKn: readings.windThrustKn,
          fuelSavingPct: readings.fuelSavingPct,
          fanRpm: [fans[0], fans[1]],
        },
        hull: {
          ...attitudeFromScene(),
          meanDraftM: (readings.draftForeM + readings.draftAftM) / 2,
          draftForeM: readings.draftForeM,
          draftAftM: readings.draftAftM,
          trimM: readings.draftAftM - readings.draftForeM,
          slammingPerHour: readings.slammingPerHour,
          ballastPct: readings.ballastPct,
          heaveM: (heavePeak = Math.max(Math.abs(shipMotion.heave), heavePeak * HEAVE_PEAK_KEPT)),
          rollPeriodS: readings.rollPeriodS,
        },
        deck: {
          reeferTempC: readings.reeferTempC,
          craneState: SIMULATED_CRANE_STATE,
          craneHydraulicBar: readings.craneHydraulicBar,
        },
        bridge: { ...SIMULATED_BRIDGE },
      };
    }

    function sensorsNow() {
      for (const sensor of SENSORS) sensors[sensor.id] = drift(sensors[sensor.id], sensor.simulated);
      return { ...sensors };
    }

    function tick() {
      state.heading = drift(state.heading, base.headingDeg);
      state.courseOffset = drift(state.courseOffset, base.courseOffsetDeg);
      state.speedOverGround = drift(state.speedOverGround, base.speedOverGroundKn);
      state.speedThroughWater = drift(state.speedThroughWater, base.speedThroughWaterKn);
      state.rateOfTurn = drift(state.rateOfTurn, base.rateOfTurnDegPerMin);
      state.windSpeed = drift(state.windSpeed, base.trueWindSpeedKn);
      state.windFrom = drift(state.windFrom, base.trueWindFromDeg);
      state.rudder = drift(state.rudder, base.rudderDeg);
      state.crossTrackError = drift(state.crossTrackError, base.crossTrackErrorNm);
      const course = wrapDegrees(state.heading + state.courseOffset);
      state.position = sail(state.position, course, state.speedOverGround, intervalSeconds);
      // The route shortens with the way made good, until the ship arrives
      state.distanceToGo = Math.max(0, state.distanceToGo - (state.speedOverGround * intervalSeconds) / SECONDS_PER_HOUR);

      const now = Date.now();
      onSnapshot({
        timestamp: now,
        observedAt: now,
        origin: "simulated",
        rateHz: SIMULATION_RATE_HZ,
        autonomyLevel: SIMULATED_AUTONOMY_LEVEL,
        navigation: {
          headingDeg: wrapDegrees(state.heading),
          courseOverGroundDeg: course,
          speedOverGroundKn: state.speedOverGround,
          speedThroughWaterKn: state.speedThroughWater,
          rateOfTurnDegPerMin: state.rateOfTurn,
          trueWind: { speedKn: state.windSpeed, fromDeg: wrapDegrees(state.windFrom) },
          rudderDeg: state.rudder,
          driftDeg: state.courseOffset,
          crossTrackErrorNm: state.crossTrackError,
          position: state.position,
        },
        voyage: {
          ...SIMULATED_VOYAGE,
          waypoints: SIMULATED_VOYAGE.waypoints.map((waypoint) => ({ ...waypoint })),
          distanceToGoNm: state.distanceToGo,
        },
        systems: systemsNow(),
        // The sea the scene's wind raised, once it has drawn one
        sea: {
          significantWaveHeightM:
            sceneSeaState.significantWaveHeightM ?? (waveHeight = drift(waveHeight, SIMULATED_WAVE_HEIGHT)),
        },
        sensors: sensorsNow(),
        alarms,
        sensorCounts: SENSOR_COUNTS,
      });
    }

    tick();
    const interval = window.setInterval(tick, intervalSeconds * 1000);

    return () => window.clearInterval(interval);
  }

  return { origin: "simulated", rateHz: SIMULATION_RATE_HZ, start, acknowledgeAlarm };
}
