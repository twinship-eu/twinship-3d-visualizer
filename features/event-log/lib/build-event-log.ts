import { findSensor, SENSORS } from "@/features/live-data/live-data-sensors";
import type { Alarm, LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import { FIRST_EVENT_NUMBER, RECORDING_ROW_SECONDS } from "../event-log-config";
import type { LifecycleStep, LogEvent, RowReading } from "../event-log-types";

type Draft = Omit<LogEvent, "number">;

const ORIGIN_NAMES: Record<LiveSnapshot["origin"], string> = {
  simulated: "the simulation",
  recorded: "the ship's recording",
  stream: "the ship's stream",
};

/** A sensor's reading at a moment of the history: the last at or before it. */
export function readingAt(history: LiveSnapshot[], sensorId: string, moment: number) {
  let reading: number | undefined;
  for (const snapshot of history) {
    if (snapshot.timestamp > moment) break;
    reading = snapshot.sensors[sensorId] ?? reading;
  }
  return reading;
}

/** A sensor's reading with its unit: "89%", "404 °C". */
export function formatReading(sensorId: string | undefined, reading: number | undefined) {
  if (!sensorId || reading === undefined) return undefined;
  const unit = findSensor(sensorId)?.unit ?? "";
  return `${reading.toFixed(0)}${unit === "%" ? "%" : ` ${unit}`}`;
}

/** "6 m 12 s". */
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} m ${seconds % 60} s`;
}

/** An alarm's highest reading between its raising and its clearing (or now), and when. */
export function peakOf(history: LiveSnapshot[], alarm: Alarm) {
  if (!alarm.sensorId) return null;
  const end = alarm.clearedAt ?? Infinity;
  let peak: { reading: number; at: number } | null = null;
  for (const snapshot of history) {
    if (snapshot.timestamp < alarm.raisedAt || snapshot.timestamp > end) continue;
    const reading = snapshot.sensors[alarm.sensorId];
    if (reading !== undefined && (!peak || reading > peak.reading)) peak = { reading, at: snapshot.timestamp };
  }
  return peak;
}

/** An alarm's life so far: raised, its peak, acknowledged, cleared. */
export function lifecycleOf(alarm: Alarm, history: LiveSnapshot[], actions: OperatorAction[]): LifecycleStep[] {
  const peak = peakOf(history, alarm);
  const acknowledged = actions.find((action) => action.kind === "acknowledged" && action.alarmId === alarm.id);
  return [
    { label: "Raised", at: alarm.raisedAt, value: formatReading(alarm.sensorId, readingAt(history, alarm.sensorId ?? "", alarm.raisedAt)) },
    { label: "Peak", at: peak?.at ?? null, value: formatReading(alarm.sensorId, peak?.reading) },
    // Acknowledged before this session (the sample's): it was, but not when
    {
      label: "Acknowledged",
      at: acknowledged?.at ?? null,
      value: !acknowledged && alarm.isAcknowledged && !alarm.clearedAt ? "before this session" : undefined,
    },
    { label: "Cleared", at: alarm.clearedAt ?? null },
  ];
}

/** The operator's entries: what they acknowledged and silenced, from the cockpit. */
function operatorEvents(actions: OperatorAction[], alarms: Alarm[]): Draft[] {
  return actions.map((action, index) => {
    const alarm = alarms.find((candidate) => candidate.id === action.alarmId);
    const what = alarm?.title ?? action.alarmId;
    return {
      id: `operator:${index}`,
      at: action.at,
      kind: "operator",
      componentLabel: alarm?.componentLabel ?? null,
      title: action.kind === "acknowledged" ? `${what} · acknowledged` : `${what} · silenced for ${formatDuration(action.until - action.at)}`,
      status: "Done",
      alarmId: action.alarmId,
    };
  });
}

/** A reading's state against its sensor's limits. */
function stateOf(reading: number, warnAt?: number, alarmAt?: number): RowReading["state"] {
  if (alarmAt !== undefined && reading >= alarmAt) return "alarm";
  if (warnAt !== undefined && reading >= warnAt) return "warning";
  return "normal";
}

/**
 * The recording's rows, one log entry each: every reading in it, and — when
 * one is past its limit — that one as the row's warning, with its alarm to
 * acknowledge.
 */
function rowEvents(history: LiveSnapshot[]): Draft[] {
  const rowMs = RECORDING_ROW_SECONDS * 1000;
  const rows = new Map<number, LiveSnapshot>();
  for (const snapshot of history) {
    const row = Math.floor(snapshot.observedAt / rowMs);
    if (!rows.has(row)) rows.set(row, snapshot);
  }
  return [...rows.values()].map((snapshot) => {
    const { navigation } = snapshot;
    const sensors = SENSORS.flatMap((sensor) => {
      const reading = snapshot.sensors[sensor.id];
      return reading === undefined ? [] : [{ sensor, reading, state: stateOf(reading, sensor.warnAt, sensor.alarmAt) }];
    });
    const readings: RowReading[] = [
      { id: "sog", label: "Speed over ground", value: `${navigation.speedOverGroundKn.toFixed(1)} kn`, state: "normal" },
      { id: "wind", label: "True wind", value: `${navigation.trueWind.speedKn.toFixed(1)} kn`, state: "normal" },
      ...sensors.map(({ sensor, reading, state }) => ({ id: sensor.id, label: `${sensor.id} · ${sensor.quantity.toLowerCase()}`, value: formatReading(sensor.id, reading) ?? "", state })),
    ];
    // The reading furthest past (or nearest to) its warning limit: what the row is about
    const worst = sensors
      .filter(({ sensor }) => sensor.warnAt !== undefined)
      .sort((first, second) => second.reading / (second.sensor.warnAt ?? 1) - first.reading / (first.sensor.warnAt ?? 1))[0];
    const isOver = worst !== undefined && worst.state !== "normal";
    const alarm = isOver ? snapshot.alarms.find((candidate) => candidate.sensorId === worst.sensor.id) : undefined;
    const base = { id: `row:${snapshot.observedAt}`, at: snapshot.timestamp, readings };
    if (!isOver || !worst) {
      return { ...base, kind: "info" as const, componentLabel: null, subject: "all readings", title: "Readings within limits", status: "Normal" };
    }
    return {
      ...base,
      kind: worst.state === "alarm" ? ("alarm" as const) : ("warning" as const),
      componentLabel: worst.sensor.componentLabel,
      subject: worst.sensor.id,
      title: `${worst.sensor.quantity} above limit · ${worst.sensor.shortName}`,
      value: formatReading(worst.sensor.id, worst.reading),
      status: alarm?.isAcknowledged ? "Acknowledged" : "Active · unack",
      isAttention: !alarm?.isAcknowledged,
      alarmId: alarm?.id,
      sensorId: worst.sensor.id,
    };
  });
}

/**
 * The event log: every row of the recording, newest first — each with its
 * readings, a warning where one is past its limit — what the operator did,
 * and where the data comes from.
 */
export function buildEventLog(history: LiveSnapshot[], actions: OperatorAction[]): LogEvent[] {
  const latest = history[history.length - 1];
  if (!latest) return [];
  const drafts: Draft[] = [
    {
      id: "system:start",
      at: history[0].timestamp,
      kind: "system",
      componentLabel: null,
      subject: latest.origin,
      title: `Live data from ${ORIGIN_NAMES[latest.origin]} · ${latest.rateHz} Hz`,
      status: "Running",
    },
    ...rowEvents(history),
    ...operatorEvents(actions, latest.alarms),
  ];
  return drafts
    .sort((first, second) => first.at - second.at || first.id.localeCompare(second.id))
    .map((draft, index) => ({ ...draft, number: FIRST_EVENT_NUMBER + index }))
    .reverse();
}
