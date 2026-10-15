import { COMPONENT_OBJECT_NAMES } from "@/features/cockpit/cockpit-systems";
import type { LogEvent } from "@/features/event-log/event-log-types";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { SENSORS } from "@/features/live-data/live-data-sensors";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { classLabel, classOf, instancesOfPart, partRelationsOf } from "@/features/ship-visualizer/lib/knowledge-graph";
import { CONTEXT_EVENTS, CONTEXT_TREND_MINUTES } from "../assistant-config";

/** The components the assistant may light up: the 3D model's parts, by their labels. */
export const HIGHLIGHTABLE_COMPONENTS = Object.keys(COMPONENT_OBJECT_NAMES);

const fixed = (value: number, digits = 1) => value.toFixed(digits);

const ORIGIN_NAMES: Record<LiveSnapshot["origin"], string> = {
  simulated: "the simulation",
  recorded: "the ship's recording (played back)",
  stream: "the ship's live stream",
};

function navigationLine({ navigation, voyage }: LiveSnapshot) {
  const position = navigation.position
    ? `${fixed(navigation.position.latitude, 4)}N ${fixed(navigation.position.longitude, 4)}E`
    : "unknown";
  return `NAVIGATION: HDG ${fixed(navigation.headingDeg, 0)}°, COG ${fixed(navigation.courseOverGroundDeg, 0)}°, SOG ${fixed(navigation.speedOverGroundKn)} kn, STW ${fixed(navigation.speedThroughWaterKn)} kn, true wind ${fixed(navigation.trueWind.speedKn)} kn from ${fixed(navigation.trueWind.fromDeg, 0)}°, rudder ${fixed(navigation.rudderDeg)}°, position ${position}, distance to go ${fixed(voyage.distanceToGoNm)} nm (design speed ${voyage.designSpeedKn} kn, eco ${voyage.ecoSpeedKn} kn)`;
}

function systemsLine({ systems, sea }: LiveSnapshot) {
  const { energy, propulsion, windAssist, hull, deck } = systems;
  return [
    `ENGINE (gensets): load ${fixed(energy.engineLoadPct, 0)}%, ${fixed(energy.engineRpm, 0)} rpm, fuel ${fixed(energy.fuelTph, 2)} t/h, hottest exhaust ${fixed(energy.exhaustTempC, 0)} °C, coolant ${fixed(energy.coolantTempC, 0)} °C, battery ${fixed(energy.batteryPct, 0)}%`,
    `PROPULSION: shafts ${fixed(propulsion.shaftRpm, 0)} rpm, ${fixed(propulsion.powerMw, 2)} MW, pitch ${fixed(propulsion.pitchPct, 0)}%, slip ${fixed(propulsion.slipPct, 0)}%`,
    `SUCTION SAILS (WAPS): thrust ${fixed(windAssist.thrustKn, 0)} kN, fuel saving ${fixed(windAssist.fuelSavingPct, 0)}%, fans ${windAssist.fanRpm.map((rpm) => fixed(rpm, 0)).join(" / ")} rpm`,
    `HULL: roll ${fixed(hull.rollDeg)}°, pitch ${fixed(hull.pitchDeg)}°, heave ±${fixed(hull.heaveM)} m, draught ${fixed(hull.meanDraftM, 2)} m (trim ${fixed(hull.trimM, 2)} m), slamming ${fixed(hull.slammingPerHour)}/h, significant wave height ${fixed(sea.significantWaveHeightM)} m`,
    `DECK: crane ${deck.craneState}, reefer ${fixed(deck.reeferTempC)} °C`,
  ].join("\n");
}

function sensorLines(snapshot: LiveSnapshot) {
  return SENSORS.map((sensor) => {
    const reading = snapshot.sensors[sensor.id];
    const limits = sensor.warnAt !== undefined ? ` · warning ${sensor.warnAt} / alarm ${sensor.alarmAt ?? "—"} ${sensor.unit}` : "";
    return `- ${sensor.id} · ${sensor.componentLabel} · ${sensor.name} · ${sensor.quantity} ${reading === undefined ? "no reading" : `${fixed(reading)} ${sensor.unit}`}${limits}`;
  }).join("\n");
}

/** A sensor's last minutes: first and last reading, peak and when, and when it crossed its warning. */
function trendLine(history: LiveSnapshot[], sensorId: string) {
  const since = history[history.length - 1].timestamp - CONTEXT_TREND_MINUTES * 60_000;
  const readings = history.filter((snapshot) => snapshot.timestamp >= since && snapshot.sensors[sensorId] !== undefined);
  if (readings.length < 2) return null;
  const sensor = SENSORS.find((candidate) => candidate.id === sensorId);
  const peak = readings.reduce((best, snapshot) => ((snapshot.sensors[sensorId] ?? -Infinity) > (best.sensors[sensorId] ?? -Infinity) ? snapshot : best));
  // A crossing only where a reading under the limit comes before it: above it all along, it says so
  const isAbove = (snapshot: LiveSnapshot) => sensor?.warnAt !== undefined && (snapshot.sensors[sensorId] ?? 0) >= sensor.warnAt;
  const crossingIndex = readings.findIndex((snapshot, index) => index > 0 && isAbove(snapshot) && !isAbove(readings[index - 1]));
  const crossing = crossingIndex > 0 ? readings[crossingIndex] : undefined;
  const aboveThroughout = readings.every(isAbove);
  const value = (snapshot: LiveSnapshot) => `${fixed(snapshot.sensors[sensorId] ?? 0)} ${sensor?.unit ?? ""}`;
  return `- ${sensorId}, last ${CONTEXT_TREND_MINUTES} min: ${value(readings[0])} at ${formatUtcTime(readings[0].timestamp)} → ${value(readings[readings.length - 1])} now; peak ${value(peak)} at ${formatUtcTime(peak.timestamp)}${crossing ? `; crossed its warning limit at ${formatUtcTime(crossing.timestamp)}` : aboveThroughout ? "; above its warning limit for all of it" : ""}`;
}

function alarmLines({ alarms }: LiveSnapshot) {
  const active = alarms.filter((alarm) => (alarm.severity === "alarm" || alarm.severity === "warning") && !alarm.isAcknowledged);
  if (active.length === 0) return "none";
  return active
    .map((alarm) =>
      [
        `- ${alarm.severity.toUpperCase()} "${alarm.title}" on ${alarm.componentLabel}${alarm.sensorId ? ` (sensor ${alarm.sensorId})` : ""}, raised ${formatUtcTime(alarm.raisedAt)}: ${alarm.detail}`,
        alarm.likelyCause && `  likely cause: ${alarm.likelyCause}`,
        alarm.recommendedActions?.length && `  recommended actions: ${alarm.recommendedActions.map((action) => `${action.title} (${action.prediction})`).join("; ")}`,
        alarm.relatedSensorIds?.length && `  related sensors: ${alarm.relatedSensorIds.join(", ")}`,
        alarm.anomaly &&
          `  BEHAVIOUR ANOMALY (${alarm.scope}): ${alarm.anomaly.summary}. Every sensor is inside its limits. Members: ${alarm.anomaly.members.join(", ")}. Score ${alarm.anomaly.score.toFixed(2)} (threshold ${alarm.anomaly.threshold}). Now vs model: ${alarm.anomaly.comparisons.map((row) => `${row.label} ${row.actual} (model ${row.model})`).join("; ")}. Drivers: ${alarm.anomaly.shares.map((share) => `${share.label} ${share.note} ${share.share}%`).join("; ")}. Likely causes: ${alarm.anomaly.causes.map((cause) => `${cause.title} ${cause.share}%`).join("; ")}.`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
}

/**
 * The log for the model: a warning's run of rows as one line (first and last
 * row, how many, its peak), every other notable entry as itself — not the
 * rows within limits, one a few seconds, which drowned the rest out.
 */
function eventLines(events: LogEvent[]) {
  const oldestFirst = [...events].reverse();
  const lines: { at: number; text: string }[] = [];
  let run: LogEvent[] = [];
  const closeRun = () => {
    if (run.length === 0) return;
    const first = run[0];
    const last = run[run.length - 1];
    const peak = run.reduce((best, event) => (parseFloat(event.value ?? "") > parseFloat(best.value ?? "") ? event : best));
    lines.push({
      at: last.at,
      text: `#${first.number}–#${last.number} ${formatUtcTime(first.at)}–${formatUtcTime(last.at)} ${first.kind.toUpperCase()} · ${first.componentLabel ?? "data stream"}${first.subject ? ` ${first.subject}` : ""} · "${first.title}" · ${run.length} rows, peak ${peak.value ?? "—"} at ${formatUtcTime(peak.at)} · ${last.status}`,
    });
    run = [];
  };
  for (const event of oldestFirst) {
    const isRunRow = event.readings !== undefined && (event.kind === "warning" || event.kind === "alarm");
    if (isRunRow && run.length > 0 && run[0].title === event.title) {
      run.push(event);
      continue;
    }
    closeRun();
    if (isRunRow) {
      run = [event];
      continue;
    }
    // Rows within limits: the data itself, in the readings and trends; not one line each
    if (event.readings !== undefined) continue;
    lines.push({
      at: event.at,
      text: `#${event.number} ${formatUtcTime(event.at)} ${event.kind.toUpperCase()} · ${event.componentLabel ?? "data stream"}${event.subject ? ` ${event.subject}` : ""} · "${event.title}"${event.value ? ` · ${event.value}` : ""} · ${event.status}`,
    });
  }
  closeRun();
  const rowsWithinLimits = events.filter((event) => event.readings !== undefined && event.kind === "info").length;
  return [
    ...lines
      .sort((first, second) => second.at - first.at)
      .slice(0, CONTEXT_EVENTS)
      .map((line) => line.text),
    `(${rowsWithinLimits} data rows with every reading within its limits are not listed)`,
  ].join("\n");
}

function knowledgeGraphLines() {
  return HIGHLIGHTABLE_COMPONENTS.map((part) => {
    const instances = instancesOfPart(part);
    if (instances.length === 0) return `- ${part}: not in the knowledge graph yet`;
    const relations = partRelationsOf(part)
      .map((relation) => `${relation.relation} ${relation.label} (${relation.instanceIds.join(", ")})`)
      .join("; ");
    return `- ${part} = ${instances.join(", ")} (${classLabel(classOf(instances[0]))}): ${relations}`;
  }).join("\n");
}

/**
 * The ship's data as the model reads it, every turn: now, the navigation and
 * systems, every sensor against its limits, the trends of those in question,
 * the active alarms, the event log and the knowledge graph's relations.
 */
export function buildAssistantContext(history: LiveSnapshot[], events: LogEvent[]) {
  const latest = history[history.length - 1];
  if (!latest) return "SHIP DATA: none received yet.";
  const inQuestion = [
    ...new Set(
      events.filter((event) => event.sensorId && (event.kind === "warning" || event.kind === "alarm" || event.kind === "info")).map((event) => event.sensorId as string)
    ),
  ];
  return [
    "SHIP DATA",
    `NOW: ${new Date(latest.timestamp).toISOString().slice(0, 19)}Z · data from ${ORIGIN_NAMES[latest.origin]} at ${latest.rateHz} Hz · autonomy level ${latest.autonomyLevel}`,
    navigationLine(latest),
    systemsLine(latest),
    `SENSORS (id · component · name · quantity now · limits):\n${sensorLines(latest)}`,
    `TRENDS:\n${inQuestion.map((sensorId) => trendLine(history, sensorId)).filter(Boolean).join("\n") || "none"}`,
    `ACTIVE ALARMS (not acknowledged):\n${alarmLines(latest)}`,
    `EVENT LOG (newest first):\n${eventLines(events) || "empty"}`,
    `KNOWLEDGE GRAPH (3D part = its instances in the graph (class): relations):\n${knowledgeGraphLines()}`,
    `COMPONENTS YOU MAY HIGHLIGHT: ${HIGHLIGHTABLE_COMPONENTS.join(", ")}`,
  ].join("\n\n");
}
