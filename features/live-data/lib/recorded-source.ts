import { PLAYBACK_WINDOW_MINUTES } from "../live-data-config";
import { RECORDED_SENSORS, RECORDING_OPENS_AFTER_FIRST_WARNING_MS } from "../live-data-recording-config";
import { SENSORS } from "../live-data-sensors";
import { alarmsUpTo, findEpisodes, type AlarmEpisode, type PlaybackLoop } from "./recorded-alarms";
import { anomaliesAt } from "./recorded-anomalies";
import { loadRecording, readRecordingAt } from "./recording";
import { withRecordedReadings } from "./recording-snapshot";
import { createSimulatedSource } from "./simulated-source";
import type { Alarm, LiveDataSource, LiveSnapshot, Recording } from "../live-data-types";

const PLAYBACK_WINDOW_MS = PLAYBACK_WINDOW_MINUTES * 60_000;
/**
 * The hull's motion for the past kept before the scene's sea moved: the
 * scene's own size of it under way (roll, pitch in degrees, heave in m) and
 * the encounter period of pitch and heave, s. The roll's period is the snapshot's.
 */
const PAST_MOTION = { rollDeg: 0.35, pitchDeg: 1.0, heaveM: 0.6, pitchPeriodS: 7.4 } as const;

/** Periods, s, of the two waves a simulated sensor's past wanders on: unrelated, so it never repeats soon. */
const PAST_SENSOR_PERIODS_S = [97, 23] as const;

/**
 * A kept moment's sensors the recording does not have, wandering about their
 * reading as the simulation's do: kept from the first snapshot alone, they
 * were one value the whole past through — a flat line on their trends.
 */
function pastSensors(snapshot: LiveSnapshot, recording: Recording): LiveSnapshot["sensors"] {
  const seconds = snapshot.timestamp / 1000;
  const sensors = { ...snapshot.sensors };
  SENSORS.forEach((sensor, index) => {
    const column = RECORDED_SENSORS[sensor.id];
    if ((column && recording.values[column]) || sensors[sensor.id] === undefined) return;
    const [slow, quick] = PAST_SENSOR_PERIODS_S;
    const wander = 0.7 * Math.sin((2 * Math.PI * seconds) / slow + index) + 0.3 * Math.sin((2 * Math.PI * seconds) / quick + 2 * index);
    sensors[sensor.id] = sensor.simulated.value + sensor.simulated.spread * wander;
  });
  return sensors;
}

/** A kept moment as the scene and the simulation would have had it: the hull's motion (roll on its period, pitch and heave on theirs), the unrecorded sensors wandering. */
function withPastMotion(snapshot: LiveSnapshot, recording: Recording): LiveSnapshot {
  const seconds = snapshot.timestamp / 1000;
  const { hull } = snapshot.systems;
  const pitchPhase = (2 * Math.PI * seconds) / PAST_MOTION.pitchPeriodS;
  return {
    ...snapshot,
    sensors: pastSensors(snapshot, recording),
    systems: {
      ...snapshot.systems,
      hull: {
        ...hull,
        rollDeg: PAST_MOTION.rollDeg * Math.sin((2 * Math.PI * seconds) / hull.rollPeriodS),
        pitchDeg: PAST_MOTION.pitchDeg * Math.sin(pitchPhase + 1),
        heaveM: PAST_MOTION.heaveM * (0.8 + 0.2 * Math.abs(Math.sin(pitchPhase / 5))),
      },
    },
  };
}

/** Active alarms first, then the logged events; newest first within each. */
function byUrgency(first: Alarm, second: Alarm) {
  const isActive = (alarm: Alarm) => !alarm.isAcknowledged && alarm.severity !== "resolved";
  return Number(isActive(second)) - Number(isActive(first)) || second.raisedAt - first.raisedAt;
}

/** A recording played from where it opens, looped, in the viewer's time. */
function createPlayback(recording: Recording, startedAt: number) {
  const { times } = recording;
  const first = times[0];
  const span = times[times.length - 1] - first;
  const episodes: AlarmEpisode[] = findEpisodes(recording);
  const firstWarning = episodes[0]?.from;
  const opensAt =
    firstWarning === undefined ? first : Math.min(firstWarning + RECORDING_OPENS_AFTER_FIRST_WARNING_MS, times[times.length - 1]);

  const loop = (index: number): PlaybackLoop => ({
    index,
    toViewerTime: (recorded) => startedAt + index * span + (recorded - opensAt),
  });

  /** The moment of the recording at a moment of the viewer's, and its loop. */
  function at(viewerMoment: number) {
    const played = opensAt - first + (viewerMoment - startedAt);
    const index = Math.floor(played / span);
    return { moment: first + (played - index * span), index };
  }

  /** The alarms at a moment: this loop's so far, and the last loop's within the timeline's reach. */
  function alarmsAt(viewerMoment: number, moment: number, index: number) {
    const earlier = index > 0 ? alarmsUpTo(recording, episodes, times[times.length - 1], loop(index - 1)) : [];
    return [...alarmsUpTo(recording, episodes, moment, loop(index)), ...earlier].filter(
      (alarm) => alarm.raisedAt >= viewerMoment - PLAYBACK_WINDOW_MS
    );
  }

  return {
    at,
    alarmsAt,
    /** A loop's mapping of the recording's moments to the viewer's. */
    toViewerTime: (index: number) => loop(index).toViewerTime,
    /** The viewer's moment of the recording's start: before it, the recording has no past to give. */
    recordedSince: startedAt - (opensAt - first),
  };
}

/**
 * The ship's recording, played: its readings, a snapshot a second, looped —
 * converted from the time-series workbook beforehand (see
 * scripts/convert-timeseries.py), as a stream would deliver them. The
 * simulation fills in what it does not record, and plays alone when there is
 * no recording.
 */
export function createRecordedSource(): LiveDataSource {
  const simulated = createSimulatedSource();
  const acknowledged = new Set<string>();

  function start(onSnapshot: (snapshot: LiveSnapshot) => void, onHistory?: (snapshots: LiveSnapshot[]) => void) {
    /** Undefined while it loads; null when there is none. */
    let recording: Recording | null | undefined;
    let playback: ReturnType<typeof createPlayback> | null = null;

    loadRecording()
      .then((loaded) => (recording = loaded))
      .catch((error: unknown) => {
        recording = null;
        console.error("The ship's recording could not be read: the simulation plays instead.", error);
      });

    function play(snapshot: LiveSnapshot, played: Recording) {
      const current = (playback ??= createPlayback(played, snapshot.timestamp));
      const { moment, index } = current.at(snapshot.timestamp);
      const alarms = current
        .alarmsAt(snapshot.timestamp, moment, index)
        .map((alarm) => (acknowledged.has(alarm.id) ? { ...alarm, isAcknowledged: true } : alarm))
        .sort(byUrgency);
      const read = { ...withRecordedReadings(snapshot, readRecordingAt(played, moment)), observedAt: moment };
      // The behaviour anomalies of the demo, on the recording's timeline, judged on its readings
      const anomalies = anomaliesAt(played, moment, { index, toViewerTime: current.toViewerTime(index) }, read).map((alarm) =>
        acknowledged.has(alarm.id) ? { ...alarm, isAcknowledged: true } : alarm
      );
      return { ...read, alarms: [...anomalies.filter((alarm) => !alarm.isAcknowledged), ...alarms, ...anomalies.filter((alarm) => alarm.isAcknowledged)] };
    }

    /**
     * The recording's past before playback opened, a snapshot a second, up to
     * the timeline's window: what a ship's stream would have kept. On the
     * first snapshot's simulated values, for what the recording lacks.
     */
    function pastOf(first: LiveSnapshot, played: Recording) {
      const since = Math.max(playback?.recordedSince ?? first.timestamp, first.timestamp - PLAYBACK_WINDOW_MS);
      const intervalMs = 1000 / first.rateHz;
      const past: LiveSnapshot[] = [];
      for (let moment = since; moment < first.timestamp; moment += intervalMs) {
        past.push(withPastMotion(play({ ...first, timestamp: moment }, played), played));
      }
      return past;
    }

    let hasSentPast = false;
    return simulated.start((snapshot) => {
      // Nothing until the recording is known to be there or not: no simulated second before it
      if (recording === undefined) return;
      if (!recording) return onSnapshot(snapshot);
      const now = play(snapshot, recording);
      if (!hasSentPast) {
        hasSentPast = true;
        onHistory?.(pastOf(snapshot, recording));
      }
      onSnapshot(now);
    });
  }

  function acknowledgeAlarm(alarmId: string) {
    acknowledged.add(alarmId);
    simulated.acknowledgeAlarm(alarmId);
  }

  return { origin: "recorded", rateHz: simulated.rateHz, start, acknowledgeAlarm };
}
