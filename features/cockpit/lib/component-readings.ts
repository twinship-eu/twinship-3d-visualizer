import type { LiveSnapshot } from "@/features/live-data/live-data-types";

/** How a reading is shown: a plain value, a healthy state, or a warning. */
export type ReadingTone = "value" | "ok" | "warn";

export type ComponentReading = { text: string; tone: ReadingTone };

/** Speed over ground, knots, above which the ship counts as under way. */
const UNDERWAY_SPEED_KN = 0.5;

/** Each tree row's reading in Live data, by its label; a row with none shows nothing. */
const READINGS: Record<string, (snapshot: LiveSnapshot) => ComponentReading> = {
  "TwinShip VESSEL": (snapshot) => ({
    text: snapshot.navigation.speedOverGroundKn > UNDERWAY_SPEED_KN ? "Underway" : "Stopped",
    tone: "value",
  }),
  "Base Hull": (snapshot) => ({ text: `T ${snapshot.systems.hull.meanDraftM.toFixed(2)} m`, tone: "value" }),
  "Hull top towers": () => ({ text: "OK", tone: "ok" }),
  "Control room": () => ({ text: "OK", tone: "ok" }),
  Radio: () => ({ text: "VHF OK", tone: "ok" }),
  Superstructure: () => ({ text: "OK", tone: "ok" }),
  Container: (snapshot) => ({ text: `${snapshot.systems.deck.reeferTempC.toFixed(1)} °C`, tone: "value" }),
  Crane: (snapshot) => ({ text: snapshot.systems.deck.craneState, tone: "value" }),
  Propellers: (snapshot) => ({ text: `${snapshot.systems.propulsion.shaftRpm.toFixed(0)} rpm`, tone: "value" }),
  Engine: (snapshot) => ({ text: `${snapshot.systems.energy.engineLoadPct.toFixed(0)}% · Normal`, tone: "value" }),
  WAPS: (snapshot) => ({ text: `${snapshot.systems.windAssist.thrustKn.toFixed(0)} kN`, tone: "value" }),
};

/** The Voyage view's tree: sections only, each with its system's reading. By section label. */
const VOYAGE_SECTION_READINGS: Record<string, (snapshot: LiveSnapshot) => ComponentReading> = {
  "Ship model": (snapshot) => READINGS["TwinShip VESSEL"](snapshot),
  Hull: (snapshot) => ({ text: `roll ${snapshot.systems.hull.rollDeg.toFixed(1)}°`, tone: "value" }),
  Superstructure: () => ({ text: "OK", tone: "ok" }),
  "Deck equipment": () => ({ text: "Secured", tone: "value" }),
  "Propeller system": (snapshot) => ({ text: `${snapshot.systems.propulsion.shaftRpm.toFixed(0)} rpm`, tone: "value" }),
  "Energy system": (snapshot) => ({ text: `${snapshot.systems.energy.fuelTph.toFixed(2)} t/h`, tone: "value" }),
  "Wind assisted propulsion system": (snapshot) => ({
    text: `${snapshot.systems.windAssist.thrustKn.toFixed(0)} kN`,
    tone: "value",
  }),
};

/** A section's reading in the Voyage view's tree; null for one with none. */
export function voyageSectionReading(label: string, snapshot: LiveSnapshot): ComponentReading | null {
  return VOYAGE_SECTION_READINGS[label]?.(snapshot) ?? null;
}

/**
 * What a tree row shows beside its label in Live data: the component's key
 * reading, or "Warning" while it has an active warning.
 */
export function componentReading(label: string, snapshot: LiveSnapshot, hasActiveAlarm: boolean): ComponentReading | null {
  if (hasActiveAlarm) return { text: "Warning", tone: "warn" };
  return READINGS[label]?.(snapshot) ?? null;
}
