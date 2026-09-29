"use client";

import { VOYAGE_CARDS } from "@/features/cockpit/cockpit-voyage";
import { SystemCardsStrip } from "@/features/cockpit/components/system-cards-strip";
import { SelectedComponentStrip } from "@/features/cockpit/component-live/selected-component-strip";
import { BridgePaneStrip } from "@/features/bridge/components/bridge-pane-strip";
import { useBridgeState } from "@/features/bridge/lib/bridge-store";
import { getSectionDotClass, getSectionIdOf } from "../lib/section-colors";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { OntologyRelationsStrip } from "./ontology-relations-strip";

type Props = {
  isOntologyMode: boolean;
  isVoyageView: boolean;
  selectedNode: ShipTreeNode | null;
  onSelectRelated: (label: string) => void;
  onShowLiveData: () => void;
};

/**
 * Under the scene, at lg: in Ontology, the selected component's relations;
 * in Live data, the systems' or the voyage's cards — on the bridge, its
 * panes — or the selected component's trends.
 */
export function SceneBottomStrip({ isOntologyMode, isVoyageView, selectedNode, onSelectRelated, onShowLiveData }: Props) {
  const { isActive: isOnBridge } = useBridgeState();
  if (isOntologyMode) {
    return selectedNode ? (
      <OntologyRelationsStrip selectedNode={selectedNode} onSelectRelated={onSelectRelated} onShowSensors={onShowLiveData} />
    ) : null;
  }
  if (selectedNode) {
    return (
      <SelectedComponentStrip
        componentLabel={selectedNode.label}
        dotClass={getSectionDotClass(getSectionIdOf(selectedNode))}
      />
    );
  }
  if (isVoyageView && isOnBridge) return <BridgePaneStrip />;
  return isVoyageView ? <SystemCardsStrip cards={VOYAGE_CARDS} showsStatus={false} /> : <SystemCardsStrip />;
}
