import { LIVE_HISTORY_LENGTH, PLAYBACK_HISTORY_LENGTH } from "../live-data-config";
import type { LiveDataSource, LiveSnapshot } from "../live-data-types";
import { createRecordedSource } from "./recorded-source";

/** Where the viewer is in time: live, or a moment of the kept history. */
export type Playback = {
  /** The moment viewed, ms since the epoch; null while live. */
  viewedAt: number | null;
  /** The oldest and latest moments kept, ms since the epoch; null before the first snapshot. */
  oldest: number | null;
  latest: number | null;
};

/** The last snapshot at or before a moment: the history is oldest first. */
function indexAt(history: LiveSnapshot[], moment: number) {
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].timestamp <= moment) return index;
  }
  return 0;
}

/**
 * The ship's snapshots, shared by every component that reads live data: the
 * last PLAYBACK_HISTORY_LENGTH of them, and the moment being viewed — live,
 * or one of them. Everything reads through the viewed moment, so paused or
 * rewound, the whole cockpit shows the ship as it was then.
 *
 * The source runs only while something is listening: started by the first
 * subscriber, stopped when the last one leaves.
 */
function createLiveDataStore(source: LiveDataSource) {
  const listeners = new Set<() => void>();
  /** Oldest first. A new array each time, so React sees the change. */
  let history: LiveSnapshot[] = [];
  let viewedAt: number | null = null;
  let stop: (() => void) | null = null;
  // What the getters hand out, rebuilt only when it changes: React compares them by identity
  let viewedSnapshot: LiveSnapshot | null = null;
  let viewedHistory: LiveSnapshot[] = [];
  let playback: Playback = { viewedAt: null, oldest: null, latest: null };
  /**
   * Alarms silenced from the cockpit, by id: until when, ms since the epoch.
   * The operator's, not the ship's — kept here, not in the snapshots.
   */
  let silences: Record<string, number> = {};

  function refresh() {
    const index = viewedAt === null ? history.length - 1 : indexAt(history, viewedAt);
    const snapshot = history[index] ?? null;
    if (snapshot !== viewedSnapshot) {
      viewedSnapshot = snapshot;
      viewedHistory = history.slice(Math.max(0, index - (LIVE_HISTORY_LENGTH - 1)), index + 1);
    }
    playback = {
      viewedAt,
      oldest: history[0]?.timestamp ?? null,
      latest: history[history.length - 1]?.timestamp ?? null,
    };
    listeners.forEach((notify) => notify());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    stop ??= source.start((snapshot) => {
      history = [...history.slice(-(PLAYBACK_HISTORY_LENGTH - 1)), snapshot];
      refresh();
    });

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }

  /**
   * Views a moment of the kept history, clamped to it — the latest moment
   * too, frozen there: a pause. Null goes live again.
   */
  function viewAt(moment: number | null) {
    const oldest = history[0]?.timestamp;
    const latest = history[history.length - 1]?.timestamp;
    viewedAt =
      moment === null || oldest === undefined || latest === undefined
        ? null
        : Math.min(Math.max(oldest, moment), latest);
    refresh();
  }

  /** Silences an alarm until a moment: it stays active, without drawing the eye. */
  function silenceAlarm(alarmId: string, until: number) {
    silences = { ...silences, [alarmId]: until };
    listeners.forEach((notify) => notify());
  }

  /** Acknowledges an alarm, and shows it at once rather than with the next snapshot. */
  function acknowledgeAlarm(alarmId: string) {
    source.acknowledgeAlarm(alarmId);
    const latest = history[history.length - 1];
    if (!latest) return;
    const acknowledged = {
      ...latest,
      alarms: latest.alarms.map((alarm) => (alarm.id === alarmId ? { ...alarm, isAcknowledged: true } : alarm)),
    };
    history = [...history.slice(0, -1), acknowledged];
    refresh();
  }

  return {
    subscribe,
    getSnapshot: () => viewedSnapshot,
    getHistory: () => viewedHistory,
    getPlayback: () => playback,
    getSilences: () => silences,
    viewAt,
    acknowledgeAlarm,
    silenceAlarm,
  };
}

/**
 * The app's live data: the ship's recording played, simulated where it
 * records nothing. To connect the ship's stream, give the store a source that
 * maps it onto `LiveSnapshot` instead.
 */
export const liveDataStore = createLiveDataStore(createRecordedSource());
