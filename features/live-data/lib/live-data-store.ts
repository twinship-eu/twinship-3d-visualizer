import { LIVE_HISTORY_LENGTH } from "../live-data-config";
import type { LiveDataSource, LiveSnapshot } from "../live-data-types";
import { createSimulatedSource } from "./simulated-source";

/**
 * The latest snapshot, and the last LIVE_HISTORY_LENGTH of them for the
 * trends, shared by every component that reads live data. The source runs
 * only while something is listening: started by the first subscriber,
 * stopped when the last one leaves.
 */
function createLiveDataStore(source: LiveDataSource) {
  const listeners = new Set<() => void>();
  let latest: LiveSnapshot | null = null;
  /** Oldest first. A new array each time, so React sees the change. */
  let history: LiveSnapshot[] = [];
  let stop: (() => void) | null = null;

  function subscribe(listener: () => void) {
    listeners.add(listener);
    stop ??= source.start((snapshot) => {
      latest = snapshot;
      history = [...history.slice(-(LIVE_HISTORY_LENGTH - 1)), snapshot];
      listeners.forEach((notify) => notify());
    });

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }

  return { subscribe, getSnapshot: () => latest, getHistory: () => history };
}

/**
 * The app's live data. Simulated for now: to connect the ship's stream, give
 * the store a source that maps it onto `LiveSnapshot` instead.
 */
export const liveDataStore = createLiveDataStore(createSimulatedSource());
