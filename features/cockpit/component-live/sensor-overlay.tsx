"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { sensorsOf, sensorState, type SensorDefinition, type SensorState } from "@/features/live-data/live-data-sensors";
import { subscribeToAnchors } from "../callouts/callout-anchors";
import { COMPONENT_LIVE } from "./component-live-config";
import { sensorAnchors } from "./sensor-anchor-projector";

const DOT_CLASSES: Record<SensorState, string> = {
  normal: "bg-ok",
  warning: "bg-warn",
  alarm: "bg-alarm",
};

/** How far the focused sensor's card sits from its dot, in CSS pixels: below and to the side. */
const CARD_OFFSET = { x: -130, y: 170 };
/** How many of the component's live readings its card shows: the panel has the rest. */
const CARD_READINGS = 4;

/**
 * Over the scene, with a component selected in Live data: a dot on each of
 * its sensors, coloured by how its reading stands against its limits, and a
 * card linked by a line to the one in focus — the alarm's, or the highest
 * reading. With an alarm the card is the alarm's reading against its
 * limits; otherwise the component's own: its main live readings, the focused
 * sensor's among them. A legend underneath.
 */
export function SensorOverlay({ componentLabel }: { componentLabel: string }) {
  const snapshot = useLiveData();
  const sensors = sensorsOf(componentLabel);
  const alarm = activeAlarmOn(snapshot, componentLabel);
  const dotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);

  // The sensor in focus: the alarm's, or the one reading highest against its warning limit
  const focus: SensorDefinition | undefined =
    sensors.find((sensor) => sensor.id === alarm?.sensorId) ??
    [...sensors]
      .filter((sensor) => sensor.warnAt !== undefined)
      .sort((a, b) => (snapshot?.sensors[b.id] ?? 0) / b.warnAt! - (snapshot?.sensors[a.id] ?? 0) / a.warnAt!)[0];
  const focusId = focus?.id;

  useEffect(() => {
    const follow = () => {
      for (const [id, dot] of Object.entries(dotRefs.current)) {
        const anchor = sensorAnchors[id];
        if (!dot) continue;
        dot.style.visibility = anchor?.isVisible ? "visible" : "hidden";
        if (anchor?.isVisible) dot.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)`;
      }
      const anchor = focusId ? sensorAnchors[focusId] : undefined;
      const card = cardRef.current;
      const line = lineRef.current;
      if (!card || !line) return;
      const isShown = !!anchor?.isVisible;
      card.style.visibility = isShown ? "visible" : "hidden";
      line.style.visibility = isShown ? "visible" : "hidden";
      if (!anchor || !isShown) return;
      const left = anchor.x + CARD_OFFSET.x;
      const top = anchor.y + CARD_OFFSET.y;
      card.style.transform = `translate(${left}px, ${top}px)`;
      line.setAttribute("x1", String(anchor.x));
      line.setAttribute("y1", String(anchor.y));
      line.setAttribute("x2", String(left + card.offsetWidth / 2));
      line.setAttribute("y2", String(top));
    };
    return subscribeToAnchors(follow);
  }, [focusId]);

  if (!snapshot || sensors.length === 0) return null;

  const focusReading = focus ? (snapshot.sensors[focus.id] ?? 0) : 0;
  const focusState = focus ? sensorState(focus, focusReading) : "normal";
  const isAlarmFocus = !!alarm;
  // The component's own main readings, where its live panel defines them
  const liveReadings = COMPONENT_LIVE[componentLabel]?.readings.slice(0, CARD_READINGS);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-label={`${componentLabel} sensors`}>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <line ref={lineRef} className={isAlarmFocus ? "stroke-warn" : "stroke-leader"} strokeWidth={1.5} />
      </svg>
      {sensors.map((sensor) => {
        const state = sensorState(sensor, snapshot.sensors[sensor.id] ?? 0);
        const isFocus = sensor.id === focus?.id;
        return (
          <span
            key={sensor.id}
            ref={(element) => {
              dotRefs.current[sensor.id] = element;
            }}
            title={`${sensor.name}: ${(snapshot.sensors[sensor.id] ?? 0).toFixed(0)}${sensor.unit}`}
            className={cn(
              "absolute top-0 left-0 rounded-full border-2 border-white",
              DOT_CLASSES[state],
              isFocus ? "size-5" : "size-3.5"
            )}
            style={{ visibility: "hidden" }}
          />
        );
      })}
      {focus && (
        <div
          ref={cardRef}
          style={{ visibility: "hidden" }}
          className={cn(
            "absolute top-0 left-0 flex w-[260px] flex-col gap-1 rounded-[10px] border bg-glass px-4 py-3 text-xs text-ink backdrop-blur",
            isAlarmFocus ? "border-warn-line" : "border-glass-line"
          )}
        >
          <span className="text-[13px] font-semibold">{isAlarmFocus ? focus.shortName : liveReadings ? componentLabel : focus.name}</span>
          {isAlarmFocus ? (
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-warn">
                {focusReading.toFixed(0)}
                {focus.unit}
              </span>
              <span className="text-muted">
                limit {focus.warnAt}
                {focus.unit} / {focus.alarmAt}
                {focus.unit}
              </span>
            </span>
          ) : liveReadings ? (
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              {liveReadings.map((reading) => (
                <div key={reading.label} className="contents">
                  <dt className="text-ink-2">{reading.label}</dt>
                  <dd className="text-right font-mono text-[13px] font-semibold tabular-nums">{reading.format(reading.value(snapshot))}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <span className="text-ink-2">
              {focus.quantity}{" "}
              <b className={cn("font-semibold", focusState === "normal" ? "text-ink" : "text-warn")}>
                {focusReading.toFixed(0)}
                {focus.unit}
              </b>
              {focus.unit === "%" && " of allowable"}
            </span>
          )}
        </div>
      )}
      <div className="absolute bottom-4 left-[72px] flex items-center gap-4 rounded-lg border border-glass-line bg-glass px-4 py-2 text-xs text-ink-2 backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ok" aria-hidden /> Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-warn" aria-hidden /> ≥ warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-alarm" aria-hidden /> ≥ alarm
        </span>
        <span className="text-muted">
          {sensors.length} sensor{sensors.length === 1 ? "" : "s"} on this component
        </span>
      </div>
    </div>
  );
}
