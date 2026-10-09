"use client";

import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { formatElapsed } from "@/features/live-data/lib/format-readings";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import type { Alarm } from "@/features/live-data/live-data-types";
import { highlightAnchors, subscribeToHighlightAnchors } from "@/features/assistant/lib/highlight-anchors";

/**
 * Over the scene while a behaviour anomaly is open: its banner along the top,
 * the balance it is judged on (now against the model), and a pin on each
 * member — linked, in a chain — moved every frame outside React.
 */
export function AnomalySceneOverlay({ alarm }: { alarm: Alarm }) {
  const anomaly = alarm.anomaly;
  // How long it has been active at the moment viewed (a replay's, too)
  const viewedAt = useLiveData()?.timestamp ?? null;
  const pinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRef = useRef<SVGPolylineElement>(null);
  const membersKey = (anomaly?.members ?? []).join("|");

  useEffect(() => {
    const members = membersKey ? membersKey.split("|") : [];
    return subscribeToHighlightAnchors(() => {
      const points: string[] = [];
      members.forEach((member, index) => {
        const pin = pinRefs.current[index];
        const anchor = highlightAnchors[member];
        if (!pin) return;
        pin.style.visibility = anchor?.isVisible ? "visible" : "hidden";
        if (!anchor?.isVisible) return;
        pin.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`;
        points.push(`${anchor.x},${anchor.y}`);
      });
      pathRef.current?.setAttribute("points", points.join(" "));
    });
  }, [membersKey]);

  if (!anomaly) return null;
  const isShip = alarm.scope === "ship";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 hidden lg:block">
      <div className="flex h-[60px] items-center gap-3 bg-anomaly px-4 text-black">
        <Activity className="size-5 shrink-0" aria-hidden />
        <strong className="shrink-0 tracking-[0.06em]">{isShip ? "SHIP ANOMALY" : "GROUP ANOMALY"}</strong>
        <span className="min-w-0 grow truncate">{anomaly.summary}</span>
        {viewedAt !== null && <span className="shrink-0 font-mono">active {formatElapsed(alarm.raisedAt, viewedAt)}</span>}
      </div>

      <section data-callout-avoid className="absolute top-[76px] left-4 w-[400px] rounded-xl border border-glass-line bg-glass p-4 text-ink backdrop-blur">
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-anomaly-ink">{isShip ? "SHIP BALANCE" : "GROUP BALANCE"} · NOW VS MODEL</h3>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1.5 text-sm">
          <span />
          <span className="text-right text-[11px] text-muted">model</span>
          <span className="text-right text-[11px] text-muted">actual</span>
          {anomaly.comparisons.map((row) => (
            <div key={row.label} className="contents">
              <span>{row.label}</span>
              <span className="text-right font-mono text-ink-2 tabular-nums">{row.model}</span>
              <span className="text-right font-mono font-semibold tabular-nums">{row.actual}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">{anomaly.comparisonNote}</p>
      </section>

      {/* The members on the ship, linked in a chain */}
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {anomaly.isChain && (
          <polyline
            ref={pathRef}
            fill="none"
            className="animate-pulse stroke-anomaly"
            strokeWidth={3}
            strokeDasharray="9 6"
            style={{ filter: "drop-shadow(0 0 6px var(--color-anomaly)) drop-shadow(0 0 12px var(--color-anomaly))" }}
          />
        )}
      </svg>
      {anomaly.members.map((member, index) => (
        <div
          key={member}
          ref={(element) => {
            pinRefs.current[index] = element;
          }}
          className="absolute top-0 left-0"
          style={{ visibility: "hidden" }}
        >
          <span className="absolute size-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-anomaly opacity-60" />
          <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-anomaly shadow-[0_0_12px_4px_var(--color-anomaly)]" />
          <span className="absolute top-5 -translate-x-1/2 rounded-md border border-glass-line bg-glass px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-ink backdrop-blur">
            {member}
          </span>
        </div>
      ))}
    </div>
  );
}
