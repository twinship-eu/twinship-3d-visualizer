import { findSensor, sensorsOf } from "@/features/live-data/live-data-sensors";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";

/** A reading the time series drawer plots: what it is, in what, and where it comes from in a snapshot. */
export type TimeSeriesDefinition = {
  id: string;
  label: string;
  unit: string;
  read: (snapshot: LiveSnapshot) => number | undefined;
  /** Its warning limit, if it has one. */
  limit?: number;
};

export const sensorSeries = (sensorId: string): TimeSeriesDefinition => {
  const sensor = findSensor(sensorId);
  return {
    id: sensorId,
    label: `${sensorId} ${(sensor?.quantity ?? "reading").toLowerCase().replace("bending ", "")}`,
    unit: sensor?.unit ?? "",
    read: (snapshot) => snapshot.sensors[sensorId],
    limit: sensor?.warnAt,
  };
};

/** The drawer's standing tabs, as the design has them: the hull's two gauges, the sea and the speed. */
export const STANDING_SERIES: TimeSeriesDefinition[] = [
  sensorSeries("SG-03"),
  sensorSeries("SG-04"),
  { id: "wave-height", label: "Wave height", unit: "m", read: (snapshot) => snapshot.sea.significantWaveHeightM },
  { id: "speed", label: "Speed", unit: "kn", read: (snapshot) => snapshot.navigation.speedOverGroundKn },
];

/** The tabs for an event: the standing ones, with the event's own sensor first if it is not among them. */
export function seriesFor(sensorId: string | undefined) {
  if (!sensorId || STANDING_SERIES.some((series) => series.id === sensorId)) return STANDING_SERIES;
  return [sensorSeries(sensorId), ...STANDING_SERIES];
}

/** Ticks on the value axis: this many, evenly from low to high. */
export const VALUE_TICKS = 4;
/** Ticks on the time axis. */
export const TIME_TICKS = 4;

/** The tabs for a component: its own sensors first, then the sea and the speed. */
export function seriesForComponent(componentLabel: string) {
  const own = sensorsOf(componentLabel).map((sensor) => sensorSeries(sensor.id));
  return [...own, ...STANDING_SERIES.filter((series) => series.id === "wave-height" || series.id === "speed")];
}
