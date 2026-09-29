"use client";

import { Scene } from "@/features/3d-scene/3d-scene";
import { LoadingRing } from "@/features/3d-scene/components/loading-ring";
import type { CalloutDefinition } from "@/features/cockpit/callouts/callout-config";
import type { LiveView } from "@/features/cockpit/cockpit-config";
import { LiveSceneProjectors } from "@/features/cockpit/components/live-scene-layers";
import { LiveSceneSync } from "@/features/cockpit/voyage/live-scene-sync";
import { VoyageSceneOverlay } from "@/features/cockpit/voyage/voyage-scene-overlay";
import { getBridgeState } from "@/features/bridge/lib/bridge-store";
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
 * assembles, the environment the ship's data describes, and in Live data
 * what projects the callouts and sensors.
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
        // The gesture hints give way to the details, and in Live data to its
        // own controls along the scene's bottom: the timeline, the voyage's
        isDetailsOpen={selectedNode !== null || live !== null}
        isCompactBelowLg={isCompactBelowLg}
        overlay={
          <>
            {/* The environment is the data's in either mode: the ship's speed, its propellers, the wind */}
            <LiveSceneSync />
            {live?.isVoyageView && <VoyageSceneOverlay />}
          </>
        }
      >
        <Ship
          modelPath={model.modelPath}
          selectedStructureNode={selectedNode}
          hoveredStructureNode={hoveredNode}
          hiddenNodeIds={model.hiddenNodeIds}
          onModelTreeLoaded={model.handleModelTreeLoaded}
          tree={model.tree}
          // On the bridge nothing but the bridge: no part lights up under the pointer
          onHover={(node) => onHover(getBridgeState().isActive ? null : node)}
          // On the bridge a click is the operator looking about, not picking a part
          onSelectByClick={(node) => {
            if (!getBridgeState().isActive) onSelectByClick(node);
          }}
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
