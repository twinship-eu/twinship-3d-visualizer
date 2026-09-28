"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { Sparkline } from "../components/sparkline";
import { CALLOUTS, type CalloutDefinition, type CalloutId } from "./callout-config";
import { calloutAnchors } from "./callout-anchors";

type Props = {
  /** Opens a component, by its label: a card's link. */
  onOpenComponent: (label: string) => void;
};

/** A label and its value, as the cards list them. */
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <span className="truncate text-muted">
      {label} <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}

function StatusOk() {
  return <span className="text-[11px] font-semibold text-ok">OK</span>;
}

/** What each card shows: the design's readings for its part. */
function CalloutBody({ id, snapshot, history }: { id: CalloutId; snapshot: LiveSnapshot; history: LiveSnapshot[] }) {
  const { systems } = snapshot;
  switch (id) {
    case "bridge":
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <Reading label="Autonomy" value={snapshot.autonomyLevel} />
          <Reading label="VHF" value={`Ch ${systems.bridge.vhfChannel}`} />
          <Reading label="Radar" value={systems.bridge.radar} />
          <Reading label="AIS" value={systems.bridge.ais} />
        </div>
      );
    case "deck":
      return (
        <div className="flex flex-col gap-0.5">
          <Reading label="Crane" value={`${systems.deck.craneState} · ${systems.deck.craneHydraulicBar.toFixed(0)} bar`} />
          <Reading label="Reefer" value={`${systems.deck.reeferTempC.toFixed(1)} °C`} />
        </div>
      );
    case "waps":
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] leading-none font-semibold">
                {systems.windAssist.thrustKn.toFixed(0)}
              </span>
              <span className="text-muted">kN thrust</span>
            </span>
            <span className="font-semibold text-ok">−{systems.windAssist.fuelSavingPct.toFixed(0)}% fuel</span>
          </div>
          <div className="flex justify-between gap-2">
            <Reading label="Rotor 1" value={`${systems.windAssist.rotorRpm[0].toFixed(0)} rpm`} />
            <Reading label="Rotor 2" value={`${systems.windAssist.rotorRpm[1].toFixed(0)} rpm`} />
          </div>
        </div>
      );
    case "propellers":
      return (
        <div className="flex flex-col gap-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[22px] leading-none font-semibold">
              {systems.propulsion.shaftRpm.toFixed(0)}
            </span>
            <span className="font-mono text-muted">rpm</span>
          </span>
          <span className="text-muted">
            Pitch {systems.propulsion.pitchPct.toFixed(0)}% · {systems.propulsion.powerMw.toFixed(2)} MW
          </span>
        </div>
      );
    case "engine":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <span className="flex shrink-0 flex-col">
              <span className="text-[10px] tracking-[0.1em] text-muted">LOAD</span>
              <span className="flex items-baseline">
                <span className="font-mono text-[26px] leading-none font-semibold">
                  {systems.energy.engineLoadPct.toFixed(0)}
                </span>
                <span className="text-muted">%</span>
              </span>
            </span>
            <Sparkline
              values={history.map((entry) => entry.systems.energy.engineLoadPct)}
              strokeClass="stroke-system-energy"
              className="h-8 min-w-0 grow"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <Reading label="RPM" value={systems.energy.engineRpm.toFixed(0)} />
            <Reading label="Fuel" value={`${systems.energy.fuelTph.toFixed(2)} t/h`} />
            <Reading label="Exhaust" value={`${systems.energy.exhaustTempC.toFixed(0)} °C`} />
            <Reading label="Coolant" value={`${systems.energy.coolantTempC.toFixed(0)} °C`} />
          </div>
        </div>
      );
  }
}

/** Where a card sits over the scene, from its slot. */
function slotStyle({ slot, widthPx }: CalloutDefinition): React.CSSProperties {
  return {
    width: widthPx,
    top: `${slot.topPct}%`,
    ...(slot.leftPct !== undefined ? { left: `${slot.leftPct}%` } : { right: `${slot.rightPct}%` }),
  };
}

/** The point of a rectangle nearest a point: where a card's line leaves it. */
function nearestOnRect(x: number, y: number, rect: DOMRect) {
  return {
    x: Math.min(Math.max(x, rect.left), rect.right),
    y: Math.min(Math.max(y, rect.top), rect.bottom),
  };
}

/**
 * The Systems view's callouts, over the scene: a card for each part of the
 * ship with its live readings, and a line from the card to the part, which
 * follows it as the camera moves and the ship rides the waves.
 *
 * The lines and dots are moved every frame outside React, from the
 * projector's anchors (`CalloutAnchorProjector`); the cards re-render only
 * with the live data, once a second.
 */
export function SystemCallouts({ onOpenComponent }: Props) {
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<CalloutId, HTMLElement | null>>>({});
  const lineRefs = useRef<Partial<Record<CalloutId, SVGLineElement | null>>>({});
  const dotRefs = useRef<Partial<Record<CalloutId, HTMLSpanElement | null>>>({});

  useEffect(() => {
    let frame = 0;
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const container = containerRef.current;
      if (!container) return;
      const origin = container.getBoundingClientRect();
      for (const { id } of CALLOUTS) {
        const anchor = calloutAnchors[id];
        const card = cardRefs.current[id];
        const line = lineRefs.current[id];
        const dot = dotRefs.current[id];
        if (!card || !line || !dot) continue;
        const isShown = !!anchor?.isVisible;
        line.style.visibility = isShown ? "visible" : "hidden";
        dot.style.visibility = isShown ? "visible" : "hidden";
        if (!anchor || !isShown) continue;

        const cardRect = card.getBoundingClientRect();
        const local = new DOMRect(cardRect.left - origin.left, cardRect.top - origin.top, cardRect.width, cardRect.height);
        const from = nearestOnRect(anchor.x, anchor.y, local);
        line.setAttribute("x1", from.x.toFixed(1));
        line.setAttribute("y1", from.y.toFixed(1));
        line.setAttribute("x2", anchor.x.toFixed(1));
        line.setAttribute("y2", anchor.y.toFixed(1));
        dot.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)`;
      }
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!snapshot) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-label="Live callouts">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {CALLOUTS.map(({ id }) => (
          <line
            key={id}
            ref={(element) => {
              lineRefs.current[id] = element;
            }}
            className="stroke-leader"
            strokeWidth={1}
            style={{ visibility: "hidden" }}
          />
        ))}
      </svg>
      {CALLOUTS.map((callout) => (
        <span
          key={`${callout.id}-dot`}
          ref={(element) => {
            dotRefs.current[callout.id] = element;
          }}
          className={cn("absolute top-0 left-0 size-3.5 rounded-full border-2 border-white", callout.dotClass)}
          style={{ visibility: "hidden" }}
          aria-hidden
        />
      ))}
      {CALLOUTS.map((callout) => (
        <article
          key={callout.id}
          ref={(element) => {
            cardRefs.current[callout.id] = element;
          }}
          style={slotStyle(callout)}
          className="pointer-events-auto absolute flex flex-col gap-2 rounded-[10px] border border-glass-line bg-glass px-3.5 py-3 text-xs text-ink backdrop-blur"
        >
          <header className="flex items-center gap-2">
            <span className={cn("size-[7px] shrink-0 rounded-full", callout.dotClass)} aria-hidden />
            <h3 className="grow truncate text-[13px] font-semibold">{callout.title}</h3>
            {callout.id === "engine" ? (
              <span className="rounded-full bg-ok-soft px-2 py-px text-[11px] font-semibold text-ok">Normal</span>
            ) : (
              callout.id !== "propellers" && callout.id !== "deck" && <StatusOk />
            )}
          </header>
          <CalloutBody id={callout.id} snapshot={snapshot} history={history} />
          {callout.id === "engine" && (
            <button
              type="button"
              onClick={() => onOpenComponent(callout.componentLabel)}
              className="cursor-pointer self-start text-[13px] font-semibold text-accent-ink hover:text-accent"
            >
              Open component details →
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
