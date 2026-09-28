"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { findSensor, sensorsOf, sensorState, type SensorState } from "@/features/live-data/live-data-sensors";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { getObjectDetailsForNode } from "@/features/ship-visualizer/selection-details";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { COMPONENT_LIVE } from "./component-live-config";
import { AlarmFocus } from "./alarm-focus";
import { LiveTab } from "./live-tab";

type Tab = "live" | "description" | "parameters";
const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "description", label: "Description" },
  { id: "parameters", label: "Parameters" },
];

const STATE_CHIPS: Record<SensorState, { label: string; className: string }> = {
  normal: { label: "NORMAL", className: "bg-ok-soft text-ok" },
  warning: { label: "WARNING", className: "bg-warn-soft text-warn" },
  alarm: { label: "ALARM", className: "bg-alarm text-white" },
};

/** The worst state among a component's sensors now. */
function componentState(componentLabel: string, snapshot: LiveSnapshot): SensorState {
  const states = sensorsOf(componentLabel).map((sensor) => sensorState(sensor, snapshot.sensors[sensor.id] ?? 0));
  if (states.includes("alarm")) return "alarm";
  if (states.includes("warning")) return "warning";
  return "normal";
}

type Props = {
  node: ShipTreeNode;
  onClose: () => void;
};

/**
 * Beside the scene, in Live data, with a component selected: its live
 * readings, description and parameters in tabs — or, while it has an active
 * alarm, the alarm in focus instead.
 */
export function ComponentLivePanel({ node, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("live");
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const details = getObjectDetailsForNode(node);
  const definition = COMPONENT_LIVE[node.label];
  const alarm = activeAlarmOn(snapshot, node.label);
  const alarmSensor = alarm?.sensorId ? findSensor(alarm.sensorId) : undefined;
  const state: SensorState = snapshot
    ? alarmSensor
      ? sensorState(alarmSensor, snapshot.sensors[alarmSensor.id] ?? 0)
      : componentState(node.label, snapshot)
    : "normal";
  const chip = STATE_CHIPS[alarm && state === "normal" ? "warning" : state];

  return (
    <aside
      aria-label={`${node.label} live data`}
      className="hidden w-[400px] shrink-0 flex-col border-l border-line bg-surface lg:flex"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", getSectionDotClass(getSectionIdOf(node)))} aria-hidden />
          <h2 className="min-w-0 grow truncate text-2xl font-bold">{details.title ?? node.label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and deselect"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-btn hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {details.tags?.map((tag) => (
            <span key={tag} className="rounded-[10px] bg-accent-soft px-2.5 py-0.5 text-xs text-accent-ink">
              {tag}
            </span>
          ))}
          <span className={cn("rounded-[10px] px-2.5 py-0.5 text-xs font-semibold", chip.className)}>{chip.label}</span>
          <span className="grow" />
          {snapshot && !alarm && (
            <span className="font-mono text-[11px] text-muted">updated {formatUtcTime(snapshot.timestamp)}</span>
          )}
        </div>
      </header>

      {alarm && snapshot ? (
        <AlarmFocus key={alarm.id} alarm={alarm} snapshot={snapshot} history={history} />
      ) : (
        <>
          <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-4 py-2.5">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "cursor-pointer rounded-md px-3.5 py-2 text-sm",
                  tab === id ? "bg-accent-soft font-semibold text-ink" : "text-ink-2 hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 grow overflow-y-auto">
            {tab === "live" &&
              (definition && snapshot ? (
                <LiveTab definition={definition} snapshot={snapshot} history={history} />
              ) : (
                <p className="px-6 py-5 text-sm text-muted">No live readings for this component yet.</p>
              ))}
            {tab === "description" && <p className="px-6 py-5 text-sm leading-[1.5] text-ink-2">{details.description}</p>}
            {tab === "parameters" && (
              <dl className="px-6 py-3 text-sm">
                {details.parameters.length === 0 && <p className="py-2 text-muted">No parameters in the ontology yet.</p>}
                {details.parameters.map((parameter) => (
                  <div key={parameter.name} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
                    <dt className="min-w-0 text-ink-2">{parameter.name}</dt>
                    <dd className="text-right font-semibold">{parameter.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
