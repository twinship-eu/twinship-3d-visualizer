"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { getObjectDetailsForNode } from "@/features/ship-visualizer/selection-details";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { AlarmFocus } from "../component-live/alarm-focus";
import { COMPONENT_LIVE } from "../component-live/component-live-config";
import { componentState, STATE_CHIPS } from "../component-live/component-state";
import { LiveTab } from "../component-live/live-tab";
import { TrendChart } from "../component-live/trend-chart";
import { OntologyDescription, OntologyParameters } from "../component-live/ontology-sections";

type Props = {
  node: ShipTreeNode;
  /** The section it is part of, named over the alarm's title. */
  sectionLabel?: string;
  /** Whether its alarm is shown rather than its live readings. */
  isShowingAlarm: boolean;
  onShowAlarm: (isShowing: boolean) => void;
  /** Opens a related component, by its label. */
  onSelectRelated: (label: string) => void;
};

/**
 * Below lg, with a component open in Live data: a sheet over the lower part
 * of the screen — its readings (the first as a trend, with the way to its
 * alarm) and details in two tabs, or its alarm with acknowledge.
 */
export function MobileComponentSheet({ node, sectionLabel, isShowingAlarm, onShowAlarm, onSelectRelated }: Props) {
  const [tab, setTab] = useState<"live" | "details">("live");
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const details = getObjectDetailsForNode(node);
  const definition = COMPONENT_LIVE[node.label];
  const alarm = activeAlarmOn(snapshot, node.label);
  const chip = STATE_CHIPS[componentState(node.label, snapshot, alarm)];
  const dotClass = getSectionDotClass(getSectionIdOf(node));
  const focusTrend = definition?.trends[0];
  const latest = history[history.length - 1];

  return (
    <div
      role="dialog"
      aria-label={`${node.label} live data`}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[58vh] flex-col rounded-t-3xl border-t border-line bg-surface text-ink shadow-[0_-12px_32px_rgba(2,8,23,0.3)] lg:hidden"
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />

      {isShowingAlarm && alarm && snapshot ? (
        <>
          <div className="flex shrink-0 flex-col gap-1 px-5 pt-3">
            <span className="flex items-center gap-2 text-sm text-ink-2">
              <span className={cn("size-2.5 rounded-full", dotClass)} aria-hidden />
              {node.label}
              {sectionLabel && ` · ${sectionLabel}`}
            </span>
          </div>
          <AlarmFocus key={alarm.id} alarm={alarm} snapshot={snapshot} history={history} isCompact />
        </>
      ) : (
        <>
          <header className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-3">
            <span className={cn("size-3 shrink-0 rounded-full", dotClass)} aria-hidden />
            <h2 className="min-w-0 grow truncate text-2xl font-bold">{details.title ?? node.label}</h2>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", chip.className)}>{chip.label}</span>
          </header>
          <div role="tablist" className="mx-5 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
            {(["live", "details"] as const).map((id) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "h-10 cursor-pointer rounded-lg text-base",
                  tab === id ? "bg-accent-soft font-semibold text-ink" : "text-muted"
                )}
              >
                {id === "live" ? "Live" : "Details"}
              </button>
            ))}
          </div>
          <div className="min-h-0 grow overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {tab === "live" && (
              <>
                {focusTrend && latest && (
                  <section
                    className={cn(
                      "mx-5 mt-4 flex flex-col gap-2 rounded-2xl border p-4",
                      alarm ? "border-warn-line" : "border-line"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-muted">{focusTrend.title.split(" · ")[0]} · last 60 s</span>
                      {alarm && (
                        <button
                          type="button"
                          onClick={() => onShowAlarm(true)}
                          className="cursor-pointer text-sm font-semibold text-accent-ink"
                        >
                          View alarm
                        </button>
                      )}
                    </div>
                    <span className={cn("font-mono text-[34px] leading-none font-semibold", alarm && "text-warn")}>
                      {focusTrend.format(focusTrend.series.map((series) => series.value(latest)))}
                    </span>
                    <TrendChart
                      lines={focusTrend.series.map((series) => ({
                        values: history.map(series.value),
                        strokeClass: series.strokeClass,
                      }))}
                      limits={focusTrend.limits?.filter((limit) => limit.tone === "warn")}
                      className="h-16 w-full"
                    />
                  </section>
                )}
                {definition && snapshot ? (
                  <LiveTab componentLabel={node.label} definition={definition} snapshot={snapshot} history={history} />
                ) : (
                  <p className="px-5 py-5 text-sm text-muted">No live readings for this component yet.</p>
                )}
              </>
            )}
            {tab === "details" && (
              <>
                <OntologyDescription node={node} onSelectRelated={onSelectRelated} />
                <OntologyParameters node={node} snapshot={snapshot} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
