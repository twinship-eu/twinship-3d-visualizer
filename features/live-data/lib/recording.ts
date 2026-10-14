import { LIVE_READINGS_URL, RECORDING_URL } from "../live-data-recording-config";
import type { Recording, RecordingColumn, RecordingLimit } from "../live-data-types";
import type { SensorState } from "../live-data-sensors";

/** A recording's readings at one moment: a column's number, or its text for the enums. */
export type RecordingReader = {
  number: (column: string) => number | undefined;
  /** A bearing, degrees 0-360: interpolated the short way round, through north if need be. */
  bearing: (column: string) => number | undefined;
  text: (column: string) => string | undefined;
};

/** The turn from one bearing to another, degrees, the short way round: -180 to 180, starboard positive. */
export function turnBetween(fromDeg: number, toDeg: number) {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

/** Rows of a recording: their moments and readings, without the columns' description. */
export type RecordingRows = Pick<Recording, "times" | "values">;

export function isRecording(data: unknown): data is Recording {
  if (typeof data !== "object" || data === null) return false;
  const { columns, times, values } = data as Partial<Recording>;
  return Array.isArray(columns) && Array.isArray(times) && times.length >= 2 && typeof values === "object";
}

/**
 * The recording at RECORDING_URL, or null when there is none. One that is
 * there but unreadable fails loudly: a broken conversion should not pass for
 * the simulation.
 */
export async function loadRecording(): Promise<Recording | null> {
  const response = await fetch(RECORDING_URL, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Recording ${RECORDING_URL}: ${response.status} ${response.statusText}`);
  const data: unknown = await response.json();
  if (!isRecording(data)) throw new Error(`Recording ${RECORDING_URL}: not the shape convert-timeseries.py writes`);
  return data;
}

/** The last row at or before a moment within the recording. */
function rowAt(times: number[], moment: number) {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (times[middle] <= moment) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The recording's rows from the one at or before `from` to the one after `to`: all `readRecordingAt` needs to read it in between. */
export function rowsBetween(recording: RecordingRows, from: number, to: number): RecordingRows {
  const { times } = recording;
  const first = rowAt(times, from);
  const last = Math.min(rowAt(times, to) + 1, times.length - 1);
  const pick = <T,>(cells: T[]) => cells.slice(first, last + 1);
  return {
    times: pick(times),
    values: Object.fromEntries(Object.entries(recording.values).map(([column, cells]) => [column, pick(cells)])),
  };
}

function isRecordingRows(data: unknown): data is RecordingRows {
  if (typeof data !== "object" || data === null) return false;
  const { times, values } = data as Partial<RecordingRows>;
  return Array.isArray(times) && times.length >= 1 && typeof values === "object" && values !== null;
}

/**
 * The recording's rows over a stretch of it, from the server, as a ship's
 * stream would send its readings.
 */
export async function fetchRowsBetween(from: number, to: number, signal: AbortSignal): Promise<RecordingRows> {
  const response = await fetch(`${LIVE_READINGS_URL}?from=${Math.round(from)}&to=${Math.round(to)}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Readings ${LIVE_READINGS_URL}: ${response.status} ${response.statusText}`);
  const data: unknown = await response.json();
  if (!isRecordingRows(data)) throw new Error(`Readings ${LIVE_READINGS_URL}: not a recording's rows`);
  return data;
}

/**
 * The readings at a moment of the recording: numbers interpolated between
 * the rows either side, texts as last recorded. A cell with no reading gives
 * undefined, and so does a column the recording does not have.
 */
export function readRecordingAt(recording: RecordingRows, moment: number): RecordingReader {
  const { times, values } = recording;
  const row = rowAt(times, moment);
  const next = Math.min(row + 1, times.length - 1);
  const share = next === row ? 0 : Math.min(1, Math.max(0, (moment - times[row]) / (times[next] - times[row])));

  /** A column's readings either side of the moment; the one before twice when there is none after. */
  function around(column: string): [number, number] | undefined {
    const before = values[column]?.[row];
    const after = values[column]?.[next];
    if (typeof before !== "number") return undefined;
    return [before, typeof after === "number" ? after : before];
  }

  return {
    number(column) {
      const readings = around(column);
      return readings && readings[0] + (readings[1] - readings[0]) * share;
    },
    bearing(column) {
      const readings = around(column);
      if (!readings) return undefined;
      return (((readings[0] + turnBetween(readings[0], readings[1]) * share) % 360) + 360) % 360;
    },
    text(column) {
      const reading = values[column]?.[row];
      return reading === null || reading === undefined ? undefined : String(reading);
    },
  };
}

function crosses(limit: RecordingLimit | null, reading: number) {
  if (!limit) return false;
  return limit.direction === "high" ? reading >= limit.value : reading <= limit.value;
}

/** How a recorded reading stands against its column's limits. */
export function recordedState(column: RecordingColumn, reading: number): SensorState {
  if (crosses(column.alarm, reading)) return "alarm";
  if (crosses(column.warning, reading)) return "warning";
  return "normal";
}
