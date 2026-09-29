import { findSensor, SENSORS } from "@/features/live-data/live-data-sensors";
import type { Alarm, LiveSnapshot, OperatorAction } from "@/features/live-data/live-data-types";
import { APPROACH_REARM_SHARE, APPROACH_SHARE, FIRST_EVENT_NUMBER } from "../event-log-config";
import type { LifecycleStep, LogEvent } from "../event-log-types";

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

/** An alarm's entries: raised, and cleared once it has. */
function alarmEvents(alarm: Alarm, history: LiveSnapshot[]): Draft[] {
  const subject = alarm.sensorId;
  if (alarm.severity === "info" || (alarm.severity === "resolved" && !alarm.clearedAt)) {
    return [{ id: `${alarm.id}:logged`, at: alarm.raisedAt, kind: "info", componentLabel: alarm.componentLabel, title: alarm.title, status: "Logged", alarmId: alarm.id }];
  }
  const isActive = alarm.severity === "alarm" || alarm.severity === "warning";
  const raised: Draft = {
    id: `${alarm.id}:raised`,
    at: alarm.raisedAt,
    kind: alarm.severity === "alarm" ? "alarm" : "warning",
    componentLabel: alarm.componentLabel,
    subject,
    title: alarm.title,
    value: formatReading(alarm.sensorId, peakOf(history, alarm)?.reading ?? readingAt(history, subject ?? "", alarm.raisedAt)),
    status: alarm.clearedAt ? "Cleared" : alarm.isAcknowledged ? "Acknowledged" : "Active · unack",
    isAttention: isActive && !alarm.isAcknowledged,
    alarmId: alarm.id,
    sensorId: alarm.sensorId,
  };
  if (!alarm.clearedAt) return [raised];
  return [
    raised,
    {
      id: `${alarm.id}:cleared`,
      at: alarm.clearedAt,
      kind: "cleared",
      componentLabel: alarm.componentLabel,
      subject,
      title: `${alarm.title} · back to normal`,
      value: formatReading(alarm.sensorId, readingAt(history, subject ?? "", alarm.clearedAt)),
      status: `Cleared after ${formatDuration(alarm.clearedAt - alarm.raisedAt)}`,
      alarmId: alarm.id,
      sensorId: alarm.sensorId,
    },
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

/** Sensors nearing their warning limit, from the kept history: noted once, again after falling back. */
function approachEvents(history: LiveSnapshot[]): Draft[] {
  const events: Draft[] = [];
  for (const sensor of SENSORS) {
    if (sensor.warnAt === undefined) continue;
    // Armed by a reading under the threshold: one already near the limit when the data starts is not approaching it
    let isArmed: boolean | null = null;
    for (const snapshot of history) {
      const reading = snapshot.sensors[sensor.id];
      if (reading === undefined) continue;
      isArmed ??= reading < sensor.warnAt * APPROACH_SHARE;
      if (isArmed && reading >= sensor.warnAt * APPROACH_SHARE && reading < sensor.warnAt) {
        isArmed = false;
        events.push({
          id: `approach:${sensor.id}:${snapshot.timestamp}`,
          at: snapshot.timestamp,
          kind: "info",
          componentLabel: sensor.componentLabel,
          subject: sensor.id,
          title: `${sensor.quantity} approaching warning limit`,
          value: formatReading(sensor.id, reading),
          status: "Watching",
          sensorId: sensor.id,
        });
      }
      if (reading < sensor.warnAt * APPROACH_REARM_SHARE) isArmed = true;
    }
  }
  return events;
}

/**
 * The event log: every entry the live data and the operator's actions make,
 * newest first — the alarms' raising, peaks and clearing, what the operator
 * did, sensors nearing their limits, and where the data comes from.
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
    ...latest.alarms.flatMap((alarm) => alarmEvents(alarm, history)),
    ...operatorEvents(actions, latest.alarms),
    ...approachEvents(history),
  ];
  return drafts
    .sort((first, second) => first.at - second.at || first.id.localeCompare(second.id))
    .map((draft, index) => ({ ...draft, number: FIRST_EVENT_NUMBER + index }))
    .reverse();
}
