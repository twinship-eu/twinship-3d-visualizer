"use client";

import { Scene } from "@/features/3d-scene/3d-scene";
import { LoadingRing } from "@/features/3d-scene/components/loading-ring";
import type { CalloutDefinition } from "@/features/cockpit/callouts/callout-config";
import type { LiveView } from "@/features/cockpit/cockpit-config";
import { LiveSceneProjectors } from "@/features/cockpit/components/live-scene-layers";
import { LiveShipSpeed } from "@/features/cockpit/voyage/live-ship-speed";
import { VoyageSceneOverlay } from "@/features/cockpit/voyage/voyage-scene-overlay";
import type { useShipModel } from "../hooks/use-ship-model";
import type { ShipTreeNode } from "../ship-visualizer-types";
import Ship from "./scene-content";
import { SceneErrorFallback } from "./scene-error-fallback";

type Props = {
  model: ReturnType<typeof useShipModel>;
  selectedNode: ShipTreeNode | null;
  hoveredNode: ShipTreeNode | null;
  onHover: (node: ShipTreeNode | null) => void;
  onSelectByClick: (node: ShipTreeNode | null) => void;
  /** Live data's state, for what it adds to the scene; null in Ontology. */
  live: {
    view: LiveView;
    isVoyageView: boolean;
    callouts: CalloutDefinition[] | null;
    liveSelection: ShipTreeNode | null;
  } | null;
  /** Below lg, the scene is a small card: no zoom controls or hints on it. */
  isCompactBelowLg: boolean;
};

/**
 * The 3D scene with the ship: its model, the loading ring while it
 * assembles, and in Live data what projects the callouts and sensors and
 * sails the ship at its live speed.
 */
export function ShipScene({ model, selectedNode, hoveredNode, onHover, onSelectByClick, live, isCompactBelowLg }: Props) {
  const { loading } = model;

  return (
    <SceneErrorFallback
      fallback={
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas text-muted">
          <p>Scene failed to load.</p>
          <p className="text-sm">
            Add a ship model at <code className="rounded bg-card px-1">public/ship/</code>
          </p>
        </div>
      }
    >
      <Scene
        // The gesture hints give way to the details, and to the Voyage view's
        // own controls along the scene's bottom
        isDetailsOpen={selectedNode !== null || !!live?.isVoyageView}
        isCompactBelowLg={isCompactBelowLg}
        overlay={
          live && (
            <>
              <LiveShipSpeed />
              {live.isVoyageView && <VoyageSceneOverlay />}
            </>
          )
        }
      >
        <Ship
          modelPath={model.modelPath}
          selectedStructureNode={selectedNode}
          hoveredStructureNode={hoveredNode}
          hiddenNodeIds={model.hiddenNodeIds}
          onModelTreeLoaded={model.handleModelTreeLoaded}
          tree={model.tree}
          onHover={onHover}
          onSelectByClick={onSelectByClick}
          onAssemblyPointsSampled={model.setAssemblyTargets}
          isInteractive={loading.isInteractive}
        />
        {live && <LiveSceneProjectors callouts={live.callouts} view={live.view} liveSelection={live.liveSelection} />}
        {loading.isRingVisible && (
          <SceneErrorFallback fallback={null}>
            <LoadingRing phase={loading.phase} assemblyTargets={model.assemblyTargets} />
          </SceneErrorFallback>
        )}
      </Scene>
    </SceneErrorFallback>
  );
}
