import type { LiveSnapshot } from "@/features/live-data/live-data-types";

const KILOWATTS_PER_MEGAWATT = 1000;
const METRES_PER_SECOND_PER_KNOT = 0.514444;

type LiveValue = (snapshot: LiveSnapshot) => string;

/**
 * Where the ship's data measures what the ontology defines: for a component,
 * by its label, its ontology parameters (by name, as in `selection-details`)
 * with the live reading of each. The rest of its parameters are the
 * ontology's own, static values.
 */
export const ONTOLOGY_LIVE_VALUES: Record<string, Record<string, LiveValue>> = {
  "Base Hull": {
    "Design draught": (snapshot) => `${snapshot.systems.hull.meanDraftM.toFixed(2)} m now`,
    "Design speed": (snapshot) => `${snapshot.navigation.speedOverGroundKn.toFixed(1)} kn now`,
  },
  Engine: {
    "twinship fuel consumption rate in MT per hr": (snapshot) => `${snapshot.systems.energy.fuelTph.toFixed(2)} MT/h`,
    "twinship ME cooling water temperature in degrees C": (snapshot) =>
      `${snapshot.systems.energy.coolantTempC.toFixed(0)} °C`,
    "twinship power propulsion total in kW": (snapshot) =>
      `${(snapshot.systems.propulsion.powerMw * KILOWATTS_PER_MEGAWATT).toFixed(0)} kW`,
  },
  Propellers: {
    "twinship rudder angle degree": (snapshot) => `${snapshot.navigation.rudderDeg.toFixed(1)}°`,
  },
  WAPS: {
    // The rotors' power: their thrust at the ship's speed
    "twinship WASP power in kW": (snapshot) =>
      `${(snapshot.systems.windAssist.thrustKn * snapshot.navigation.speedOverGroundKn * METRES_PER_SECOND_PER_KNOT).toFixed(0)} kW`,
    "twinship WASP power reduction efficiency percentage": (snapshot) =>
      `${snapshot.systems.windAssist.fuelSavingPct.toFixed(0)}%`,
  },
};
