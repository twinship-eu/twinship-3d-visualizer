"use client";

import { useMemo } from "react";
import { getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { SYSTEMS_CALLOUTS, VOYAGE_CALLOUTS } from "../callouts/callout-config";
import type { LiveView, ViewerMode } from "../cockpit-config";

type Inputs = {
  mode: ViewerMode;
  liveView: LiveView;
  isShowingCallouts: boolean;
  selectedNode: ShipTreeNode | null;
  isModelReady: boolean;
  tree: ShipTreeNode[];
};

/** What the layout shows, from the viewer's mode, the Live data view and the selection. */
export function useLiveLayout({ mode, liveView, isShowingCallouts, selectedNode, isModelReady, tree }: Inputs) {
  const isOntologyMode = mode === "ontology";
  /** In Live data with a component selected: its live panel, sensors and trends. */
  const liveSelection = isOntologyMode ? null : selectedNode;
  const isVoyageView = !isOntologyMode && liveView === "voyage" && liveSelection === null;
  const liveSelectionSection = liveSelection
    ? SHIP_TREE_SECTIONS.find(
        (section) => section.id === getSectionIdOf(liveSelection) && section.id !== liveSelection.id
      )
    : undefined;
  // The callouts over the scene: the Voyage view's, or the Systems view's
  // unless turned off. They give way to a selected component's own details
  const callouts =
    isOntologyMode || liveSelection !== null || !isModelReady
      ? null
      : isVoyageView
        ? VOYAGE_CALLOUTS
        : isShowingCallouts
          ? SYSTEMS_CALLOUTS
          : null;
  // The Voyage view's tree: its sections only, each with its reading
  const voyageTree = useMemo(() => tree.map((node) => ({ ...node, children: undefined })), [tree]);

  return {
    isOntologyMode,
    liveSelection,
    isVoyageView,
    liveSelectionSection,
    callouts,
    sidebarTree: isVoyageView ? voyageTree : tree,
    /** Below lg, in Live data: the scene is a card among the tab's content. */
    isMobileCard: !isOntologyMode && liveSelection === null,
  };
}
