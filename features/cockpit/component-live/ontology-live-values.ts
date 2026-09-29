import type { LiveSnapshot } from "@/features/live-data/live-data-types";

const METRES_PER_SECOND_PER_KNOT = 0.514444;

type LiveValue = (snapshot: LiveSnapshot) => string;

/**
 * Where the ship's data measures what the ontology defines: for a component,
 * by its label, its parameters — by ontology property for the parts from the
 * knowledge graph (twRudderAngleDegree), by name for the rest — with the live
 * reading of each. Only the same quantity: a maximum gets the reading "now"
 * beside it, never in its place.
 */
export const ONTOLOGY_LIVE_VALUES: Record<string, Record<string, LiveValue>> = {
  "Base Hull": {
    "Design draught": (snapshot) => `${snapshot.systems.hull.meanDraftM.toFixed(2)} m now`,
    "Design speed": (snapshot) => `${snapshot.navigation.speedOverGroundKn.toFixed(1)} kn now`,
  },
  Engine: {
    twShaftSpeedMaxInRevPerMin: (snapshot) => `${snapshot.systems.energy.engineRpm.toFixed(0)} rpm now`,
  },
  Propellers: {
    twRudderAngleDegree: (snapshot) => `${snapshot.navigation.rudderDeg.toFixed(1)}°`,
    twPropellerPitchMaxInPercentage: (snapshot) => `${snapshot.systems.propulsion.pitchPct.toFixed(0)}% now`,
  },
  WAPS: {
    // The sails' power, both: their thrust at the ship's speed
    twWASPPowerInKW: (snapshot) =>
      `${(snapshot.systems.windAssist.thrustKn * snapshot.navigation.speedOverGroundKn * METRES_PER_SECOND_PER_KNOT).toFixed(0)} kW both`,
    twWASPPowerReductionEfficiencyPercentage: (snapshot) => `${snapshot.systems.windAssist.fuelSavingPct.toFixed(0)}% both`,
  },
};
