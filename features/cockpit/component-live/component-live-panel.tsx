"use client";

import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { getObjectDetailsForNode } from "@/features/ship-visualizer/selection-details";
import { getSectionDotClass, getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { COMPONENT_LIVE } from "./component-live-config";
import { AlarmFocus } from "./alarm-focus";
import { LiveTab } from "./live-tab";
import { componentState, STATE_CHIPS } from "./component-state";
import { ConnectedComponents } from "./connected-components";
import { OntologyDescription, OntologyParameters } from "./ontology-sections";

type Tab = "live" | "description" | "parameters";
const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "description", label: "Description" },
  { id: "parameters", label: "Parameters" },
];

type Props = {
  node: ShipTreeNode;
  onClose: () => void;
  /** Opens a related component, by its label. */
  onSelectRelated: (label: string) => void;
  /** Opens this component in the Ontology. */
  onOpenInOntology: () => void;
};

/**
 * Beside the scene, in Live data, with a component selected: its live
 * readings, and what the ontology says of it — its description, relations
 * and parameters, the measured ones with their live readings — in tabs; or,
 * while it has an active alarm, the alarm in focus instead.
 */
export function ComponentLivePanel({ node, onClose, onSelectRelated, onOpenInOntology }: Props) {
  const [tab, setTab] = useState<Tab>("live");
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const details = getObjectDetailsForNode(node);
  const definition = COMPONENT_LIVE[node.label];
  const alarm = activeAlarmOn(snapshot, node.label);
  const chip = STATE_CHIPS[componentState(node.label, snapshot, alarm)];

  return (
    <aside
      aria-label={`${node.label} live data`}
      className="hidden w-[400px] shrink-0 flex-col border-l border-line bg-surface lg:flex"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", getSectionDotClass(getSectionIdOf(node)))} aria-hidden />
          <h2 className="min-w-0 grow truncate text-2xl font-bold">
            {details.titleHref ? (
              <a
                href={details.titleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-2 hover:text-accent-ink"
                aria-label={`${details.title ?? node.label} in the ontology (opens in new tab)`}
              >
                <span className="truncate">{details.title ?? node.label}</span>
                <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden />
              </a>
            ) : (
              (details.title ?? node.label)
            )}
          </h2>
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
        <AlarmFocus key={alarm.id} alarm={alarm} snapshot={snapshot} history={history}>
          <ConnectedComponents node={node} onSelect={onSelectRelated} />
        </AlarmFocus>
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
                <>
                  <LiveTab componentLabel={node.label} definition={definition} snapshot={snapshot} history={history} />
                  <div className="px-6 pb-5 text-sm">
                    <ConnectedComponents node={node} onSelect={onSelectRelated} />
                  </div>
                </>
              ) : (
                <p className="px-6 py-5 text-sm text-muted">No live readings for this component yet.</p>
              ))}
            {tab === "description" && (
              <OntologyDescription node={node} onSelectRelated={onSelectRelated} onOpenInOntology={onOpenInOntology} />
            )}
            {tab === "parameters" && <OntologyParameters node={node} snapshot={snapshot} />}
          </div>
        </>
      )}
    </aside>
  );
}
