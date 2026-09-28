import { findSensor, sensorsOf, sensorState, type SensorState } from "@/features/live-data/live-data-sensors";
import type { Alarm, LiveSnapshot } from "@/features/live-data/live-data-types";

/** How each state reads as a chip. */
export const STATE_CHIPS: Record<SensorState, { label: string; className: string }> = {
  normal: { label: "NORMAL", className: "bg-ok-soft text-ok" },
  warning: { label: "WARNING", className: "bg-warn-soft text-warn" },
  alarm: { label: "ALARM", className: "bg-alarm text-white" },
};

/** The worst state among a component's sensors now. */
function worstSensorState(componentLabel: string, snapshot: LiveSnapshot): SensorState {
  const states = sensorsOf(componentLabel).map((sensor) => sensorState(sensor, snapshot.sensors[sensor.id] ?? 0));
  if (states.includes("alarm")) return "alarm";
  if (states.includes("warning")) return "warning";
  return "normal";
}

/**
 * A component's state now: its active alarm's sensor against its limits —
 * at least a warning while the alarm is active — or the worst of its sensors.
 */
export function componentState(componentLabel: string, snapshot: LiveSnapshot | null, alarm: Alarm | null): SensorState {
  if (!snapshot) return "normal";
  const alarmSensor = alarm?.sensorId ? findSensor(alarm.sensorId) : undefined;
  if (alarm) {
    const state = alarmSensor ? sensorState(alarmSensor, snapshot.sensors[alarmSensor.id] ?? 0) : "warning";
    return state === "normal" ? "warning" : state;
  }
  return worstSensorState(componentLabel, snapshot);
}
