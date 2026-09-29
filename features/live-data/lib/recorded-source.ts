import { PLAYBACK_WINDOW_MINUTES } from "../live-data-config";
import { RECORDING_OPENS_AFTER_FIRST_WARNING_MS } from "../live-data-recording-config";
import { alarmsUpTo, findEpisodes, type AlarmEpisode, type PlaybackLoop } from "./recorded-alarms";
import { loadRecording, readRecordingAt } from "./recording";
import { withRecordedReadings } from "./recording-snapshot";
import { createSimulatedSource } from "./simulated-source";
import type { Alarm, LiveDataSource, LiveSnapshot, Recording } from "../live-data-types";

const PLAYBACK_WINDOW_MS = PLAYBACK_WINDOW_MINUTES * 60_000;

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
      return { ...withRecordedReadings(snapshot, readRecordingAt(played, moment)), alarms };
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
        past.push(play({ ...first, timestamp: moment }, played));
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
