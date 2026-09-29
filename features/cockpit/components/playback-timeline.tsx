"use client";

import { useRef } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayback, useLiveData, viewLiveDataAt } from "@/features/live-data/hooks/use-live-data";
import { formatElapsed } from "@/features/live-data/lib/format-readings";
import { PLAYBACK_WINDOW_MINUTES } from "@/features/live-data/live-data-config";

const WINDOW_MS = PLAYBACK_WINDOW_MINUTES * 60_000;

/**
 * Over the scene's foot, in the Systems view: the last half hour, to look
 * back through. Pause freezes the cockpit where it is; dragging along the
 * track shows the ship as it was then — every reading, callout and card —
 * and LIVE, or play, comes back to now. The alarms raised in the window are
 * marked on it; before the first snapshot kept, the track is dimmed.
 */
export function PlaybackTimeline() {
  const { viewedAt, oldest, latest } = usePlayback();
  const alarms = useLiveData()?.alarms ?? [];
  const trackRef = useRef<HTMLDivElement>(null);
  if (latest === null || oldest === null) return null;

  const windowStart = latest - WINDOW_MS;
  const shareOf = (moment: number) => Math.min(Math.max((moment - windowStart) / WINDOW_MS, 0), 1);
  const isLive = viewedAt === null;
  const viewed = viewedAt ?? latest;

  /** The moment under the pointer, along the track. */
  const momentAt = (clientX: number) => {
    const track = trackRef.current?.getBoundingClientRect();
    if (!track) return latest;
    return windowStart + ((clientX - track.left) / track.width) * WINDOW_MS;
  };

  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
    else if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // Dragged to the track's end: back to live
    const moment = momentAt(event.clientX);
    viewLiveDataAt(moment >= latest ? null : moment);
  };

  return (
    <div data-callout-avoid className="pointer-events-auto absolute bottom-4 left-1/2 z-20 hidden w-[min(636px,calc(100%-10rem))] -translate-x-1/2 items-center gap-3 rounded-[10px] border border-glass-line bg-glass py-2 pr-4 pl-2 text-ink backdrop-blur lg:flex">
      <button
        type="button"
        onClick={() => viewLiveDataAt(isLive ? latest : null)}
        aria-label={isLive ? "Pause on this moment" : "Back to live"}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-btn hover:bg-seg-on"
      >
        {isLive ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
      <span className="shrink-0 font-mono text-xs text-muted">−{PLAYBACK_WINDOW_MINUTES} min</span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Moment viewed"
        aria-valuemin={-PLAYBACK_WINDOW_MINUTES * 60}
        aria-valuemax={0}
        aria-valuenow={Math.round((viewed - latest) / 1000)}
        aria-valuetext={isLive ? "Live" : `${formatElapsed(viewed, latest)} ago`}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 60_000 : 10_000;
          if (event.key === "ArrowLeft") viewLiveDataAt(viewed - step);
          if (event.key === "ArrowRight") viewLiveDataAt(viewed + step >= latest ? null : viewed + step);
          if (event.key === "End") viewLiveDataAt(null);
        }}
        onPointerDown={scrub}
        onPointerMove={scrub}
        className="relative h-6 grow cursor-pointer touch-none focus-visible:outline-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-track">
          {/* Before the first snapshot kept: nothing to look back at */}
          <div className="absolute inset-y-0 left-0 rounded-l-full bg-line" style={{ width: `${shareOf(oldest) * 100}%` }} />
          <div
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{ left: `${shareOf(oldest) * 100}%`, width: `${(shareOf(viewed) - shareOf(oldest)) * 100}%` }}
          />
        </div>
        {alarms
          .filter((alarm) => alarm.raisedAt >= windowStart && (alarm.severity === "warning" || alarm.severity === "alarm"))
          .map((alarm) => (
            <span
              key={alarm.id}
              title={alarm.title}
              className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn"
              style={{ left: `${shareOf(alarm.raisedAt) * 100}%` }}
            />
          ))}
        <span
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white",
            isLive ? "border-accent" : "border-warn"
          )}
          style={{ left: `${shareOf(viewed) * 100}%` }}
          aria-hidden
        />
      </div>
      {isLive ? (
        <span className="shrink-0 text-xs font-bold tracking-[0.1em] text-ok">LIVE</span>
      ) : (
        <button
          type="button"
          onClick={() => viewLiveDataAt(null)}
          className="shrink-0 cursor-pointer font-mono text-xs font-semibold text-warn hover:text-ink"
        >
          −{formatElapsed(viewed, latest)} · go live
        </button>
      )}
    </div>
  );
}
