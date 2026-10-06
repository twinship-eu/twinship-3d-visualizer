"use client";

import { EventLogPanel } from "@/features/event-log/components/event-log-panel";
import { LogSceneOverlay } from "@/features/event-log/components/log-scene-overlay";
import { LogBesideShipNote, LogNodeCount } from "@/features/event-log/components/log-sidebar";
import { resetEventLogState, useEventLogState } from "@/features/event-log/lib/event-log-store";
import { useEventLog } from "@/features/event-log/hooks/use-event-log";
import { SYSTEMS_CALLOUTS, VOYAGE_CALLOUTS, type CalloutDefinition } from "../callouts/callout-config";
import { AssistantEvidenceStrip } from "@/features/assistant/components/assistant-evidence-strip";
import { AssistantPanel } from "@/features/assistant/components/assistant-panel";
import { askAssistant, useAssistantState } from "@/features/assistant/lib/assistant-store";
import { getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import type { CockpitPanel } from "../cockpit-config";
import { useCockpitPanel } from "./use-cockpit-panel";

type Inputs = {
  isOntologyMode: boolean;
  /** Opens a component on the ship, by its label. */
  onOpenComponent: (label: string) => void;
  /** Clears the selection: a panel opens on the whole ship. */
  onClearSelection: () => void;
  /** What the tree's rows show otherwise: the assistant tags its highlights over it. */
  renderReading?: (node: ShipTreeNode) => React.ReactNode;
};

/** A tree row the assistant's answer names: tagged, as the design has it. */
function RelatedTag() {
  return <span className="rounded-md border border-accent-line px-1.5 text-[11px] text-accent-ink">related</span>;
}

/**
 * Live data's panels — the event log and the ship assistant, each beside
 * the scene — and what they change around them: the top bar's buttons, the
 * tree's counts and clicks while the log is open, its note under the tree.
 */
export function useCockpitPanels({ isOntologyMode, onOpenComponent, onClearSelection, renderReading }: Inputs) {
  const { panel, setPanel, logSystem, setLogSystem } = useCockpitPanel();
  const { highlights, latestReply } = useAssistantState();
  const openPanel = isOntologyMode ? null : panel;
  const isLogOpen = openPanel === "log";
  const isAssistantOpen = openPanel === "assistant";
  const highlighted = new Set(highlights.map((highlight) => highlight.component));
  // The event the log has selected: its component gets its callout on the ship, pinned to it
  const { selectedEventId } = useEventLogState();
  const { events } = useEventLog();
  const focusedLabel = isLogOpen ? (events.find((event) => event.id === selectedEventId)?.componentLabel ?? null) : null;
  const focusedCallout: CalloutDefinition | undefined = focusedLabel
    ? [...SYSTEMS_CALLOUTS, ...VOYAGE_CALLOUTS].find((callout) => callout.componentLabel === focusedLabel)
    : undefined;

  const changePanel = (next: CockpitPanel | null) => {
    if (next !== "log") resetEventLogState();
    onClearSelection();
    void setPanel(next);
  };
  const showOnShip = (label: string) => {
    void setPanel(null);
    onOpenComponent(label);
  };
  const openLog = () => changePanel("log");
  const ask = (question: string) => {
    askAssistant(question);
    void setPanel("assistant");
  };

  return {
    panel: openPanel,
    changePanel,
    ask,
    showOnShip,
    /** The callouts give way to the assistant's highlights, as the design has it, and to the log. */
    hidesCallouts: isLogOpen || (isAssistantOpen && highlights.length > 0),
    /** While the log is open: the callout of the selected event's component only, pinned to it on the ship. */
    logCallouts: focusedCallout ? [focusedCallout] : null,
    /**
     * While the log is open, the tree filters it and counts its events; while
     * the assistant is, it tags what the answer names; null otherwise.
     */
    sidebar: isLogOpen
      ? {
          onSelect: (node: ShipTreeNode) => {
            const sectionId = getSectionIdOf(node);
            void setLogSystem(logSystem === sectionId ? null : sectionId);
          },
          renderReading: (node: ShipTreeNode) => <LogNodeCount node={node} filterId={logSystem} />,
          footer: <LogBesideShipNote onBack={() => changePanel(null)} />,
        }
      : isAssistantOpen && highlighted.size > 0
        ? {
            onSelect: undefined,
            renderReading: (node: ShipTreeNode) => (highlighted.has(node.label) ? <RelatedTag /> : renderReading?.(node)),
            footer: undefined,
          }
        : null,
    /** The assistant beside the scene, and its evidence under it; null while closed. */
    assistantPanel: isAssistantOpen ? (
      <AssistantPanel onClose={() => void setPanel(null)} onOpenLog={openLog} onOpenComponent={showOnShip} />
    ) : null,
    // Only once an answer has evidence: until then, the strip it replaces stays
    evidenceStrip:
      isAssistantOpen && latestReply && (latestReply.evidenceSensor || latestReply.citedEvents.length > 0) ? (
        <AssistantEvidenceStrip onOpenLog={openLog} />
      ) : null,
    /** The event log beside the scene, the ship in the middle; null while closed. */
    logPanel: isLogOpen ? (
      <EventLogPanel systemId={logSystem} onFocus={onOpenComponent} onShowWholeShip={onClearSelection} onAsk={ask} onClose={() => void setPanel(null)} />
    ) : null,
    /** Over the scene in Live data: the tab that opens and closes the log, and what the camera is on while it is open. */
    logScene: isOntologyMode ? null : (
      <LogSceneOverlay isLogOpen={isLogOpen} onToggleLog={() => changePanel(isLogOpen ? null : "log")} />
    ),
  };
}
