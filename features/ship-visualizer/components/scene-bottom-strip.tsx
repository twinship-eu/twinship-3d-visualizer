"use client";

import { VOYAGE_CARDS } from "@/features/cockpit/cockpit-voyage";
import { SystemCardsStrip } from "@/features/cockpit/components/system-cards-strip";
import { SelectedComponentStrip } from "@/features/cockpit/component-live/selected-component-strip";
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
 * in Live data, the systems' or the voyage's cards, or the selected
 * component's trends.
 */
export function SceneBottomStrip({ isOntologyMode, isVoyageView, selectedNode, onSelectRelated, onShowLiveData }: Props) {
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
  return isVoyageView ? <SystemCardsStrip cards={VOYAGE_CARDS} showsStatus={false} /> : <SystemCardsStrip />;
}
