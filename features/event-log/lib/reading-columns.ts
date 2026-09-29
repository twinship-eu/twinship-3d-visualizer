import type { LiveSnapshot } from "@/features/live-data/live-data-types";

/** A column of the readings table: what, in what unit, the tree section it belongs to, and how to read it. */
export type ReadingColumn = {
  id: string;
  label: string;
  unit: string;
  /** Its section in the tree, by id: the system filter keeps its columns. */
  sectionId: string;
  digits: number;
  value: (snapshot: LiveSnapshot) => number | undefined;
};

/** The time series the table shows: the snapshot's readings, a column each. */
export const READING_COLUMNS: ReadingColumn[] = [
  { id: "sog", label: "SOG", unit: "kn", sectionId: "hull", digits: 1, value: (s) => s.navigation.speedOverGroundKn },
  { id: "heading", label: "HDG", unit: "°", sectionId: "hull", digits: 0, value: (s) => s.navigation.headingDeg },
  { id: "wind", label: "True wind", unit: "kn", sectionId: "hull", digits: 1, value: (s) => s.navigation.trueWind.speedKn },
  { id: "roll", label: "Roll", unit: "°", sectionId: "hull", digits: 1, value: (s) => s.systems.hull.rollDeg },
  { id: "sg03", label: "SG-03", unit: "%", sectionId: "hull", digits: 1, value: (s) => s.sensors["SG-03"] },
  { id: "sg04", label: "SG-04", unit: "%", sectionId: "hull", digits: 1, value: (s) => s.sensors["SG-04"] },
  { id: "load", label: "Gensets load", unit: "%", sectionId: "energy", digits: 1, value: (s) => s.systems.energy.engineLoadPct },
  { id: "ex4", label: "EX-4", unit: "°C", sectionId: "energy", digits: 1, value: (s) => s.sensors["EX-4"] },
  { id: "coolant", label: "Coolant", unit: "°C", sectionId: "energy", digits: 1, value: (s) => s.systems.energy.coolantTempC },
  { id: "fuel", label: "Fuel", unit: "t/h", sectionId: "energy", digits: 2, value: (s) => s.systems.energy.fuelTph },
  { id: "battery", label: "Battery", unit: "%", sectionId: "energy", digits: 1, value: (s) => s.systems.energy.batteryPct },
  { id: "shaft", label: "Shafts", unit: "rpm", sectionId: "propeller", digits: 1, value: (s) => s.systems.propulsion.shaftRpm },
  { id: "power", label: "Shaft power", unit: "MW", sectionId: "propeller", digits: 2, value: (s) => s.systems.propulsion.powerMw },
  { id: "pitch", label: "Pitch", unit: "%", sectionId: "propeller", digits: 1, value: (s) => s.systems.propulsion.pitchPct },
  { id: "thrust", label: "Sail thrust", unit: "kN", sectionId: "windAssisted", digits: 1, value: (s) => s.systems.windAssist.thrustKn },
  { id: "saving", label: "Saving", unit: "%", sectionId: "windAssisted", digits: 1, value: (s) => s.systems.windAssist.fuelSavingPct },
  { id: "reefer", label: "Reefer", unit: "°C", sectionId: "deck", digits: 1, value: (s) => s.systems.deck.reeferTempC },
];

/** The columns for a system, or every one. */
export function readingColumnsFor(sectionId: string | null) {
  const columns = READING_COLUMNS.filter((column) => !sectionId || column.sectionId === sectionId);
  return columns.length > 0 ? columns : READING_COLUMNS;
}
