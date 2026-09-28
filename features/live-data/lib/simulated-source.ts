import {
  METRES_PER_DEGREE_LATITUDE,
  METRES_PER_NAUTICAL_MILE,
  SECONDS_PER_HOUR,
  SIMULATED_AUTONOMY_LEVEL,
  SIMULATED_BRIDGE,
  SIMULATED_CRANE_STATE,
  SIMULATED_SENSOR_COUNTS,
  SIMULATION_SYSTEMS_BASELINE,
  SIMULATION_BASELINE,
  SIMULATION_PULL,
  SIMULATION_RATE_HZ,
  SIMULATION_START_POSITION,
} from "../live-data-config";
import { createMockAlarms } from "../live-data-mock";
import type { GeoPosition, LiveDataSource, LiveSnapshot, ShipSystems } from "../live-data-types";

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
  position: GeoPosition;
};

type SystemsReading = keyof typeof SIMULATION_SYSTEMS_BASELINE;

/** A little apart, so the two rotors do not read the same. */
const ROTOR_OFFSET_RPM = 5;

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

  function start(onSnapshot: (snapshot: LiveSnapshot) => void) {
    const startedAt = Date.now();
    const alarms = createMockAlarms(startedAt);
    const state: SimulatedState = {
      heading: base.headingDeg.value,
      courseOffset: base.courseOffsetDeg.value,
      speedOverGround: base.speedOverGroundKn.value,
      speedThroughWater: base.speedThroughWaterKn.value,
      rateOfTurn: base.rateOfTurnDegPerMin.value,
      windSpeed: base.trueWindSpeedKn.value,
      windFrom: base.trueWindFromDeg.value,
      position: { ...SIMULATION_START_POSITION },
    };
    const readings = Object.fromEntries(
      Object.entries(SIMULATION_SYSTEMS_BASELINE).map(([name, { value }]) => [name, value])
    ) as Record<SystemsReading, number>;
    const rotors: [number, number] = [
      SIMULATION_SYSTEMS_BASELINE.rotorRpm.value + ROTOR_OFFSET_RPM,
      SIMULATION_SYSTEMS_BASELINE.rotorRpm.value - ROTOR_OFFSET_RPM,
    ];
    const intervalSeconds = 1 / SIMULATION_RATE_HZ;

    function systemsNow(): ShipSystems {
      for (const name of Object.keys(readings) as SystemsReading[]) {
        readings[name] = drift(readings[name], SIMULATION_SYSTEMS_BASELINE[name]);
      }
      const rotorBaseline = SIMULATION_SYSTEMS_BASELINE.rotorRpm;
      rotors[0] = drift(rotors[0], { value: rotorBaseline.value + ROTOR_OFFSET_RPM, spread: rotorBaseline.spread });
      rotors[1] = drift(rotors[1], { value: rotorBaseline.value - ROTOR_OFFSET_RPM, spread: rotorBaseline.spread });

      return {
        propulsion: { shaftRpm: readings.shaftRpm, powerMw: readings.shaftPowerMw, pitchPct: readings.pitchPct },
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
          rotorRpm: [rotors[0], rotors[1]],
        },
        hull: { rollDeg: readings.rollDeg, pitchDeg: readings.pitchDeg, meanDraftM: readings.meanDraftM },
        deck: {
          reeferTempC: readings.reeferTempC,
          craneState: SIMULATED_CRANE_STATE,
          craneHydraulicBar: readings.craneHydraulicBar,
        },
        bridge: { ...SIMULATED_BRIDGE },
      };
    }

    function tick() {
      state.heading = drift(state.heading, base.headingDeg);
      state.courseOffset = drift(state.courseOffset, base.courseOffsetDeg);
      state.speedOverGround = drift(state.speedOverGround, base.speedOverGroundKn);
      state.speedThroughWater = drift(state.speedThroughWater, base.speedThroughWaterKn);
      state.rateOfTurn = drift(state.rateOfTurn, base.rateOfTurnDegPerMin);
      state.windSpeed = drift(state.windSpeed, base.trueWindSpeedKn);
      state.windFrom = drift(state.windFrom, base.trueWindFromDeg);
      const course = wrapDegrees(state.heading + state.courseOffset);
      state.position = sail(state.position, course, state.speedOverGround, intervalSeconds);

      onSnapshot({
        timestamp: Date.now(),
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
          position: state.position,
        },
        systems: systemsNow(),
        alarms,
        sensorCounts: SIMULATED_SENSOR_COUNTS,
      });
    }

    tick();
    const interval = window.setInterval(tick, intervalSeconds * 1000);

    return () => window.clearInterval(interval);
  }

  return { origin: "simulated", rateHz: SIMULATION_RATE_HZ, start };
}
