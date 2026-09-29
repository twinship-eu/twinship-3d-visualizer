"use client";

import { EventLogView } from "@/features/event-log/components/event-log-view";
import { EventsPerSystemNote, LogNodeCount } from "@/features/event-log/components/log-sidebar";
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
 * Live data's panels — the event log over the scene, the ship assistant
 * beside it — and what they change around them: the top bar's buttons, the
 * tree's counts and clicks while the log is open, its note under the tree.
 */
export function useCockpitPanels({ isOntologyMode, onOpenComponent, onClearSelection, renderReading }: Inputs) {
  const { panel, setPanel, logSystem, setLogSystem } = useCockpitPanel();
  const { highlights, latestReply } = useAssistantState();
  const openPanel = isOntologyMode ? null : panel;
  const isLogOpen = openPanel === "log";
  const isAssistantOpen = openPanel === "assistant";
  const highlighted = new Set(highlights.map((highlight) => highlight.component));

  const changePanel = (next: CockpitPanel | null) => {
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
    /** The callouts give way to the assistant's highlights, as the design has it. */
    hidesCallouts: isAssistantOpen && highlights.length > 0,
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
          footer: <EventsPerSystemNote onBack={() => void setPanel(null)} />,
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
    logView: isLogOpen ? (
      <EventLogView
        systemId={logSystem}
        onSystemChange={(systemId) => void setLogSystem(systemId)}
        onShowOnShip={showOnShip}
        onAsk={ask}
      />
    ) : null,
  };
}
