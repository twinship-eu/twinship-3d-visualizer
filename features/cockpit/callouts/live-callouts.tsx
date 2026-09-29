"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { componentState, STATE_CHIPS } from "../component-live/component-state";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { Sparkline } from "../components/sparkline";
import type { CalloutDefinition, CalloutId } from "./callout-config";
import { calloutAnchors, shipOutline, subscribeToAnchors } from "./callout-anchors";
import { glideShare, layoutCards, type LayoutRect } from "./callout-layout";

type Props = {
  callouts: CalloutDefinition[];
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

/**
 * A callout's status, as its component stands now: OK or Normal while its
 * sensors are within their limits, else the warning or the alarm.
 */
function CalloutStatus({ callout, snapshot }: { callout: CalloutDefinition; snapshot: LiveSnapshot }) {
  const state = componentState(callout.componentLabel, snapshot, activeAlarmOn(snapshot, callout.componentLabel));
  if (state !== "normal") {
    const chip = STATE_CHIPS[state];
    return <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold", chip.className)}>{chip.label}</span>;
  }
  if (callout.status === "normal") {
    return <span className="rounded-full bg-ok-soft px-2 py-px text-[11px] font-semibold text-ok">Normal</span>;
  }
  return callout.status === "ok" ? <span className="text-[11px] font-semibold text-ok">OK</span> : null;
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
            <Reading label="Fan 1" value={`${systems.windAssist.fanRpm[0].toFixed(0)} rpm`} />
            <Reading label="Fan 2" value={`${systems.windAssist.fanRpm[1].toFixed(0)} rpm`} />
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
    case "voyageSails":
      return (
        <span className="text-muted">
          <b className="font-mono font-semibold text-ink">{systems.windAssist.thrustKn.toFixed(0)} kN</b> · auto-trim
        </span>
      );
    case "voyagePropellers":
      return (
        <span className="text-muted">
          <b className="font-mono font-semibold text-ink">{systems.propulsion.shaftRpm.toFixed(0)} rpm</b> · pitch{" "}
          {systems.propulsion.pitchPct.toFixed(0)}% · slip {systems.propulsion.slipPct.toFixed(0)}%
        </span>
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

/** How quickly a card glides to its new place, in seconds (the time constant). */
const GLIDE_TIME_CONSTANT_S = 0.15;
/** How often the panels the cards keep clear of are measured again, in ms: they seldom move. */
const AVOID_REFRESH_MS = 500;
/** The panels over the scene that the cards keep clear of. */
const AVOID_SELECTOR = "[data-callout-avoid]";

/** The point of a rectangle nearest a point: where a card's line leaves it. */
function nearestOnRect(x: number, y: number, rect: DOMRect) {
  return {
    x: Math.min(Math.max(x, rect.left), rect.right),
    y: Math.min(Math.max(y, rect.top), rect.bottom),
  };
}

/**
 * The Live data callouts, over the scene: a card for each part of the
 * ship with its live readings, and a line from the card to the part. The
 * cards keep out beside the ship, at their parts' height, as the camera
 * turns and the ship rides the waves — gliding, clear of the ship, of the
 * panels over the scene and of each other.
 *
 * Cards, lines and dots are moved every frame outside React, as soon as the
 * projector has written its anchors (`CalloutAnchorProjector`); the cards
 * re-render only with the live data, once a second.
 */
export function LiveCallouts({ callouts, onOpenComponent }: Props) {
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<CalloutId, HTMLElement | null>>>({});
  const lineRefs = useRef<Partial<Record<CalloutId, SVGLineElement | null>>>({});
  const dotRefs = useRef<Partial<Record<CalloutId, HTMLSpanElement | null>>>({});

  useEffect(() => {
    /** Where each card is now, gliding towards where the layout puts it. */
    const positions: Partial<Record<CalloutId, { x: number; y: number }>> = {};
    /** The side of the ship each card was on last frame: kept, so a part near the middle does not flip it. */
    const sides: Partial<Record<CalloutId, "left" | "right">> = {};
    /** Where each card's place was last frame, for its order in the stack. */
    const targetYs: Partial<Record<CalloutId, number>> = {};
    let avoid: LayoutRect[] = [];
    let avoidMeasuredAt = -Infinity;
    let lastFrame = performance.now();

    const follow = () => {
      const container = containerRef.current;
      if (!container) return;
      const now = performance.now();
      const share = glideShare((now - lastFrame) / 1000, GLIDE_TIME_CONSTANT_S);
      lastFrame = now;
      const origin = container.getBoundingClientRect();
      const bounds = { width: origin.width, height: origin.height };
      if (now - avoidMeasuredAt > AVOID_REFRESH_MS) {
        avoidMeasuredAt = now;
        // The panels over the scene: they live in several layers of it, so looked up in the page
        avoid = [...document.querySelectorAll<HTMLElement>(AVOID_SELECTOR)].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0
            ? [{ x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height }]
            : [];
        });
      }

      // The cards whose parts are in view, beside them
      const shown = callouts.filter(({ id }) => calloutAnchors[id]?.isVisible && cardRefs.current[id]);
      const layout = layoutCards(
        shown.map(({ id, placement }) => {
          const card = cardRefs.current[id] as HTMLElement;
          const anchor = calloutAnchors[id] as { x: number; y: number };
          return {
            width: card.offsetWidth,
            height: card.offsetHeight,
            anchor,
            placement,
            previousSide: sides[id],
            previousY: targetYs[id],
          };
        }),
        avoid,
        bounds,
        shipOutline.slices
      );

      for (const { id } of callouts) {
        const anchor = calloutAnchors[id];
        const card = cardRefs.current[id];
        const line = lineRefs.current[id];
        const dot = dotRefs.current[id];
        if (!card || !line || !dot) continue;
        const target = layout[shown.findIndex((callout) => callout.id === id)];
        if (target) {
          sides[id] = target.side;
          targetYs[id] = target.y;
        }
        const isShown = !!anchor?.isVisible && target !== undefined;
        // A card whose part is out of view waits where it was, hidden
        card.style.visibility = isShown ? "visible" : "hidden";
        line.style.visibility = isShown ? "visible" : "hidden";
        dot.style.visibility = isShown ? "visible" : "hidden";
        if (!anchor || !isShown) continue;

        const current = positions[id];
        const position = (positions[id] = current
          ? { x: current.x + (target.x - current.x) * share, y: current.y + (target.y - current.y) * share }
          : { x: target.x, y: target.y });
        card.style.transform = `translate(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px)`;

        const rect = new DOMRect(position.x, position.y, target.width, target.height);
        const from = nearestOnRect(anchor.x, anchor.y, rect);
        line.setAttribute("x1", from.x.toFixed(1));
        line.setAttribute("y1", from.y.toFixed(1));
        line.setAttribute("x2", anchor.x.toFixed(1));
        line.setAttribute("y2", anchor.y.toFixed(1));
        dot.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)`;
      }
    };
    return subscribeToAnchors(follow);
  }, [callouts]);

  if (!snapshot) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-label="Live callouts">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {callouts.map(({ id }) => (
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
      {callouts.map((callout) => (
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
      {callouts.map((callout) => (
        <article
          key={callout.id}
          ref={(element) => {
            cardRefs.current[callout.id] = element;
          }}
          style={{ width: callout.widthPx, visibility: "hidden" }}
          // The whole card opens its component
          role="button"
          tabIndex={0}
          aria-label={`${callout.title}: open ${callout.componentLabel}`}
          onClick={() => onOpenComponent(callout.componentLabel)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpenComponent(callout.componentLabel);
          }}
          className="pointer-events-auto absolute top-0 left-0 flex cursor-pointer flex-col gap-2 rounded-[10px] border border-glass-line bg-glass px-3.5 py-3 text-xs text-ink backdrop-blur transition-colors hover:border-accent-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <header className="flex items-center gap-2">
            <span className={cn("size-[7px] shrink-0 rounded-full", callout.dotClass)} aria-hidden />
            <h3 className="grow truncate text-[13px] font-semibold">{callout.title}</h3>
            <CalloutStatus callout={callout} snapshot={snapshot} />
          </header>
          <CalloutBody id={callout.id} snapshot={snapshot} history={history} />
          {/* The card is the link: this only says so, as the design has it */}
          {callout.hasDetailsLink && (
            <span className="self-start text-[13px] font-semibold text-accent-ink">Open component details →</span>
          )}
        </article>
      ))}
    </div>
  );
}
