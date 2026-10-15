import { RECORDED_ALARM_CLEAR_DELAY_MS, RECORDED_COMPONENT_PARTS, RECORDED_SENSORS } from "../live-data-recording-config";
import { ALARM_ADVICE } from "../live-data-mock";
import { recordedState } from "./recording";
import type { Alarm, Recording, RecordingColumn } from "../live-data-types";

/** A stretch of a recording where a column's alarm is raised: from, and until it clears — the recording's end at the latest. */
export type AlarmEpisode = { column: RecordingColumn; from: number; until: number };

/** Where a recorded moment is in the viewer's time: one loop of the playback. */
export type PlaybackLoop = {
  /** Which loop, for the alarms' ids: the same stretch played again is a new alarm. */
  index: number;
  /** The viewer's moment, ms since the epoch, of a moment of the recording in this loop. */
  toViewerTime: (recordedMoment: number) => number;
};

const HOTTEST_CYLINDER_PARAMETER = "TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-CYLINDER";

/** The cockpit's short names of the recorded quantities it raises alarms on, by parameter. */
const PARAMETER_TITLES: Record<string, string> = {
  "TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-IN-°C": "Exhaust temp",
  "TWINSHIP-BENDING-STRESS-PERCENTAGE-OF-ALLOWABLE": "Hull bending stress",
  "TWINSHIP-ME-COOLING-WATER-TEMPERATURE-IN-°C": "Coolant temp",
  "TWINSHIP-ESS-STATE-OF-CHARGE-PERCENTAGE": "Battery charge",
};

const SENSOR_BY_COLUMN = Object.fromEntries(Object.entries(RECORDED_SENSORS).map(([sensor, column]) => [column, sensor]));

/** The 3D part standing for a component of the knowledge graph. */
export function partOf(componentId: string) {
  return RECORDED_COMPONENT_PARTS.find(([prefix]) => componentId.startsWith(prefix))?.[1] ?? componentId;
}

/** "TWINSHIP-TRUE-WIND-SPEED-IN-KN" as "True wind speed". */
function humanize(parameter: string) {
  const words = parameter.replace(/^TWINSHIP-/, "").replace(/-IN-.*$/, "").replaceAll("-", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Every stretch of the recording where a column with limits is past its
 * warning, in order: back within them for less than the clear delay, still the same stretch.
 */
export function findEpisodes(recording: Recording): AlarmEpisode[] {
  const episodes: AlarmEpisode[] = [];
  for (const column of recording.columns) {
    if (!column.warning && !column.alarm) continue;
    const end = recording.times[recording.times.length - 1];
    let open: AlarmEpisode | null = null;
    /** When the open stretch's reading came back within its limits, while it waits out the delay. */
    let clearedAt: number | null = null;
    recording.values[column.name]?.forEach((reading, row) => {
      const isRaised = typeof reading === "number" && recordedState(column, reading) !== "normal";
      const time = recording.times[row];
      if (isRaised && !open) episodes.push((open = { column, from: time, until: end }));
      if (isRaised) clearedAt = null;
      if (!isRaised && open) {
        clearedAt ??= time;
        if (time - clearedAt >= RECORDED_ALARM_CLEAR_DELAY_MS) {
          // Cleared once the delay is out, as the alarm system clears it: not known before
          open.until = time;
          open = null;
          clearedAt = null;
        }
      }
    });
  }
  return episodes.sort((first, second) => first.from - second.from);
}

/**
 * An episode as the cockpit's alarm, at a moment of the recording: active
 * while it lasts, with its reading's state then; resolved once it has ended.
 */
function toAlarm(recording: Recording, episode: AlarmEpisode, moment: number, loop: PlaybackLoop): Alarm {
  const { column } = episode;
  const isActive = moment < episode.until;
  const index = Math.max(0, recording.times.findLastIndex((time) => time <= moment));
  const reading = recording.values[column.name]?.[index];
  const state = typeof reading === "number" ? recordedState(column, reading) : "warning";
  const limit = column.warning ?? column.alarm;
  const isLow = limit?.direction === "low";
  // The cylinder that raised it, when the component reports its hottest
  const cylinder = recording.values[`${column.component}.${HOTTEST_CYLINDER_PARAMETER}`]?.[
    recording.times.indexOf(episode.from)
  ];
  const sensorId = SENSOR_BY_COLUMN[column.name];
  const part = partOf(column.component);

  return {
    id: `${column.name}@${loop.index}:${episode.from}`,
    componentLabel: part,
    title: [
      `${PARAMETER_TITLES[column.parameter] ?? humanize(column.parameter)} ${isLow ? "low" : "high"}`,
      ...(typeof cylinder === "number" ? [`Cyl ${cylinder}`] : []),
    ].join(" · "),
    detail: `${part} · ${column.component} · ${isLow ? "under" : "over"} ${limit?.value ?? ""}${isActive ? "" : " · back to normal"}`,
    severity: isActive ? (state === "alarm" ? "alarm" : "warning") : "resolved",
    raisedAt: loop.toViewerTime(episode.from),
    ...(isActive ? {} : { clearedAt: loop.toViewerTime(episode.until) }),
    isAcknowledged: !isActive,
    sensorId,
    ...(sensorId ? ALARM_ADVICE[sensorId] : {}),
  };
}

/** The alarms of a loop up to a moment of the recording: every episode begun by then. */
export function alarmsUpTo(recording: Recording, episodes: AlarmEpisode[], moment: number, loop: PlaybackLoop): Alarm[] {
  return episodes.filter((episode) => episode.from <= moment).map((episode) => toAlarm(recording, episode, moment, loop));
}
