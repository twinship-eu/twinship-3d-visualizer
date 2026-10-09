"use client";

import { VOYAGE_CARDS } from "@/features/cockpit/cockpit-voyage";
import { SystemCardsStrip } from "@/features/cockpit/components/system-cards-strip";
import { TimeSeriesDrawer } from "@/features/event-log/components/time-series-drawer";
import { IS_TIME_SERIES_DRAWER_ENABLED } from "@/features/event-log/event-log-config";
import { sensorsOf } from "@/features/live-data/live-data-sensors";
import { SelectedComponentStrip } from "@/features/cockpit/component-live/selected-component-strip";
import { BridgePaneStrip } from "@/features/bridge/components/bridge-pane-strip";
import { useBridgeState } from "@/features/bridge/lib/bridge-store";
import { getSectionDotClass, getSectionIdOf } from "../lib/section-colors";
import type { ShipTreeNode } from "../ship-visualizer-types";

type Props = {
  isOntologyMode: boolean;
  isVoyageView: boolean;
  selectedNode: ShipTreeNode | null;
};

/**
 * Under the scene, at lg: nothing in Ontology (the details card has the
 * relations); in Live data, the systems' or the voyage's cards — on the bridge, its
 * panes — or the selected component's trends.
 */
export function SceneBottomStrip({ isOntologyMode, isVoyageView, selectedNode }: Props) {
  const { isActive: isOnBridge } = useBridgeState();
  // In Ontology the relations are in the details card: nothing under the scene
  if (isOntologyMode) return null;
  if (selectedNode) {
    return (
      // The component's readings over the kept window, the log's events on them; the trends without it
      IS_TIME_SERIES_DRAWER_ENABLED && sensorsOf(selectedNode.label).length > 0 ? (
        <TimeSeriesDrawer componentLabel={selectedNode.label} isEmbedded />
      ) : (
        <SelectedComponentStrip componentLabel={selectedNode.label} dotClass={getSectionDotClass(getSectionIdOf(selectedNode))} />
      )
    );
  }
  if (isVoyageView && isOnBridge) return <BridgePaneStrip />;
  return isVoyageView ? <SystemCardsStrip cards={VOYAGE_CARDS} showsStatus={false} /> : <SystemCardsStrip />;
}
