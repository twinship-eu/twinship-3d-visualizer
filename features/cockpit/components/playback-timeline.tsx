"use client";

import { useRef } from "react";
import { FastForward, Pause, Play, Rewind, SkipBack } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayback, useLiveData, viewLiveDataAt } from "@/features/live-data/hooks/use-live-data";
import { formatElapsed, formatUtcTime } from "@/features/live-data/lib/format-readings";
import { distanceMadeGood, etaHours, formatHours } from "../lib/voyage-math";

/** How far the step buttons move, in ms: a minute. */
const STEP_MS = 60_000;
/** The arrow keys' steps: ten seconds, a minute with Shift. */
const KEY_STEP_MS = 10_000;
const BUTTON_CLASS =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-btn hover:text-ink disabled:cursor-default disabled:opacity-40";

type Props = {
  /** In Voyage: the route's line over the track — origin, progress, destination — as of the moment viewed. */
  showsRoute?: boolean;
  /** After the replay, in the same bar: the navigation layer's readouts. */
  trailing?: React.ReactNode;
  /**
   * Only as wide as its contents, the track a set length: the Live view's
   * bar. Its parent is then the container the trailing readouts give way by.
   */
  isCompact?: boolean;
  className?: string;
};
/** The compact bar's track, CSS pixels. */
const COMPACT_TRACK_CLASS = "w-[200px] shrink-0";

/**
 * Over the scene's foot: the kept data, to go back through and play again.
 * Play and pause act on the moment viewed — paused in the past, play moves
 * on from there as the data came, and catches up to live; ⏮ goes to the
 * start, ⏪ ⏩ a minute; dragging along the track shows the ship as it was
 * then. The warnings raised are marked on it. In Voyage it carries the route
 * too, so there is one bar for both.
 */
export function PlaybackTimeline({ showsRoute = false, trailing, isCompact = false, className }: Props) {
  const { viewedAt, oldest, latest, isPlaying } = usePlayback();
  const snapshot = useLiveData();
  const trackRef = useRef<HTMLDivElement>(null);
  if (latest === null || oldest === null) return null;

  const span = Math.max(latest - oldest, 1);
  const shareOf = (moment: number) => Math.min(Math.max((moment - oldest) / span, 0), 1);
  const isLive = viewedAt === null;
  const viewed = viewedAt ?? latest;
  const alarms = snapshot?.alarms ?? [];

  /** The moment under the pointer, along the track. */
  const momentAt = (clientX: number) => {
    const track = trackRef.current?.getBoundingClientRect();
    if (!track) return latest;
    return oldest + ((clientX - track.left) / track.width) * span;
  };
  /** Goes to a moment, keeping on playing or paused; past now, live again. */
  const goTo = (moment: number, keepPlaying = isPlaying && !isLive) => viewLiveDataAt(moment >= latest ? null : Math.max(oldest, moment), keepPlaying);
  const togglePlay = () => {
    if (isLive) viewLiveDataAt(latest);
    else viewLiveDataAt(viewed, !isPlaying);
  };

  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
    else if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    goTo(momentAt(event.clientX));
  };

  const voyage = snapshot?.voyage;
  const madeGoodPct = voyage ? (distanceMadeGood(voyage) / voyage.totalNm) * 100 : 0;

  return (
    <div
      data-callout-avoid
      className={cn(
        !isCompact && "@container",
        "pointer-events-auto hidden flex-col gap-1 overflow-hidden rounded-[10px] border border-glass-line bg-glass px-2 py-1.5 text-ink backdrop-blur lg:flex",
        className ?? "absolute bottom-4 left-1/2 z-20 w-[min(720px,calc(100%-10rem))] -translate-x-1/2"
      )}
    >
      {showsRoute && voyage && snapshot && (
        <div className="flex items-baseline justify-between gap-3 px-2 pt-0.5 font-mono text-[11px]">
          <span className="font-semibold">{voyage.origin}</span>
          <span className="text-muted">
            {madeGoodPct.toFixed(0)}% · DTG {voyage.distanceToGoNm.toFixed(1)} nm · ETA {formatHours(etaHours(voyage, snapshot.navigation.speedOverGroundKn))}
          </span>
          <span className="font-semibold">{voyage.destination}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => goTo(oldest, false)} disabled={viewed <= oldest} aria-label="To the start" title="To the start" className={BUTTON_CLASS}>
          <SkipBack className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={() => goTo(viewed - STEP_MS)} disabled={viewed <= oldest} aria-label="A minute back" title="A minute back" className={BUTTON_CLASS}>
          <Rewind className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play from here"}
          title={isPlaying ? "Pause" : "Play from here"}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-btn hover:bg-seg-on"
        >
          {isPlaying ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
        <button type="button" onClick={() => goTo(viewed + STEP_MS)} disabled={isLive} aria-label="A minute on" title="A minute on" className={BUTTON_CLASS}>
          <FastForward className="size-4" aria-hidden />
        </button>
        {/* The moment shown, as a clock: where the eye looks first */}
        <span className="w-[60px] shrink-0 text-center font-mono text-xs font-semibold tabular-nums">{formatUtcTime(viewed)}</span>
        <div
          ref={trackRef}
          role="slider"
          aria-label="Moment viewed"
          aria-valuemin={Math.round((oldest - latest) / 1000)}
          aria-valuemax={0}
          aria-valuenow={Math.round((viewed - latest) / 1000)}
          aria-valuetext={isLive ? "Live" : `${formatElapsed(viewed, latest)} ago`}
          tabIndex={0}
          onKeyDown={(event) => {
            const step = event.shiftKey ? STEP_MS : KEY_STEP_MS;
            if (event.key === "ArrowLeft") goTo(viewed - step);
            if (event.key === "ArrowRight") goTo(viewed + step);
            if (event.key === "Home") goTo(oldest, false);
            if (event.key === "End") viewLiveDataAt(null);
          }}
          onPointerDown={scrub}
          onPointerMove={scrub}
          className={cn(
            "relative mx-1 h-6 cursor-pointer touch-none focus-visible:outline-none",
            isCompact ? COMPACT_TRACK_CLASS : "min-w-[120px] grow"
          )}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-track">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${shareOf(viewed) * 100}%` }} />
          </div>
          {alarms
            .filter((alarm) => alarm.raisedAt >= oldest && (alarm.severity === "warning" || alarm.severity === "alarm"))
            .map((alarm) => (
              <span
                key={alarm.id}
                title={`${formatUtcTime(alarm.raisedAt)} · ${alarm.title}`}
                className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn"
                style={{ left: `${shareOf(alarm.raisedAt) * 100}%` }}
              />
            ))}
          <span
            className={cn(
              "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow",
              isLive ? "border-accent" : "border-warn"
            )}
            style={{ left: `${shareOf(viewed) * 100}%` }}
            aria-hidden
          />
        </div>
        {/* One fixed width for LIVE and for "−17:00 · live": the track does not jump between them */}
        <span className="flex w-[104px] shrink-0 justify-end pr-2">
          {isLive ? (
            <span className="text-xs font-bold tracking-[0.1em] text-ok">LIVE</span>
          ) : (
            <button
              type="button"
              onClick={() => viewLiveDataAt(null)}
              className="cursor-pointer font-mono text-xs font-semibold whitespace-nowrap text-warn tabular-nums hover:text-ink"
            >
              −{formatElapsed(viewed, latest)} · live
            </button>
          )}
        </span>
        {trailing}
      </div>
    </div>
  );
}
