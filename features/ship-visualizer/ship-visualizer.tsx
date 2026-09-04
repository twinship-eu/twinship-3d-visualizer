"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Scene } from "@/features/3d-scene/3d-scene";
import { IS_SCENE_INSPECTOR_ENABLED } from "@/features/3d-scene/lib/webgpu-renderer";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import Ship from "./components/scene-content";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import {
  isNodeInNonSelectableSection,
  mapModelTreeToSections,
} from "./lib/map-tree-to-sections";
import { collectNodeIds } from "./lib/filter-tree";
import {
  SHIP_VISUALIZER_LAYOUT,
  DEFAULT_SHIP_MODEL_PATH,
  IS_MODEL_VARIANT_TOGGLE_ENABLED,
  RAW_SHIP_MODEL_GLB,
  PREVIOUS_SHIP_MODEL_GLB,
} from "./ship-visualizer-config";
import type { ShipTreeNode } from "./ship-visualizer-types";
import { OntologyExplorer } from "../ontology-explorrer/ontology-explorer";
import { SelectionDetailsModal } from "./components/selection-details-modal";
import {
  ModelVariantToggle,
  type ModelVariant,
} from "./components/model-variant-toggle";
import { LoadingRing } from "@/features/3d-scene/components/loading-ring";
import {
  SceneInspector,
  type LoadingRingControls,
} from "@/features/3d-scene/components/scene-inspector";
import { useModelLoadProgress } from "./hooks/use-model-load-progress";

const MAX_WIDTH_PX = SHIP_VISUALIZER_LAYOUT.MAX_LEFT_PANEL_WIDTH_PX;

/** Builds of the default model, offered by the development-only toggle. */
const MODEL_PATH_BY_VARIANT: Record<ModelVariant, string> = {
  previous: PREVIOUS_SHIP_MODEL_GLB,
  optimized: DEFAULT_SHIP_MODEL_PATH,
  raw: RAW_SHIP_MODEL_GLB,
};

const SHIP_MODEL_SECTION = MOCK_SHIP_TREE[0];

export function ShipVisualizer() {
  const [selectedModelPath, setSelectedModelPath] =
    useState(DEFAULT_SHIP_MODEL_PATH);
  const [selectedStructureNode, setSelectedStructureNode] =
    useState<ShipTreeNode | null>(null);
  const [hoveredStructureNode, setHoveredStructureNode] =
    useState<ShipTreeNode | null>(null);
  const [modelTree, setModelTree] = useState<ShipTreeNode[] | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<
    Record<string, boolean>
  >({});
  const [modelVariant, setModelVariant] =
    useState<ModelVariant>("optimized");

  // Only the default model has alternate builds to compare against; any other
  // model the tree points at is shown as-is.
  const isModelReady = modelTree !== null;
  const [assemblyTargets, setAssemblyTargets] = useState<Float32Array | null>(
    null
  );
  const loading = useModelLoadProgress(isModelReady, assemblyTargets !== null);
  // Held so the dev Inspector can bind controls straight to the ring's tunables.
  const [ringControls, setRingControls] =
    useState<LoadingRingControls | null>(null);

  const isDefaultModel = selectedModelPath === DEFAULT_SHIP_MODEL_PATH;
  const renderedModelPath = isDefaultModel
    ? MODEL_PATH_BY_VARIANT[modelVariant]
    : selectedModelPath;

  useEffect(() => {
    setModelTree(null);
  }, [renderedModelPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedStructureNode !== null) {
        setSelectedStructureNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStructureNode]);

  const handleModelTreeLoaded = useCallback((tree: ShipTreeNode[]) => {
    const topLevelOnly = tree.map((node) => ({
      ...node,
      children: undefined,
    }));
    const sectioned = mapModelTreeToSections(topLevelOnly);
    setModelTree([SHIP_MODEL_SECTION, ...sectioned]);
    setSelectedStructureNode(null);
  }, []);

  const handleSelectNode = useCallback((node: ShipTreeNode) => {
    if (node.modelPath) {
      setSelectedModelPath(node.modelPath);
      return;
    }
    if (isNodeInNonSelectableSection(node)) return;
    setSelectedStructureNode((prev) =>
      prev?.id === node.id ? null : node
    );
  }, []);

  const handleHover = useCallback((node: ShipTreeNode | null) => {
    setHoveredStructureNode(node);
  }, []);

  const handleSelectByClick = useCallback((node: ShipTreeNode | null) => {
    setSelectedStructureNode(node);
  }, []);

  const setSectionVisible = useCallback(
    (node: ShipTreeNode, visible: boolean) => {
      const ids = collectNodeIds(node);
      setVisibleNodeIds((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = visible;
        return next;
      });
    },
    []
  );

  const hiddenNodeIds = useMemo(
    () =>
      new Set(
        Object.entries(visibleNodeIds)
          .filter(([, v]) => v === false)
          .map(([id]) => id)
      ),
    [visibleNodeIds]
  );

  const tree = modelTree ?? MOCK_SHIP_TREE;

  const handleSelectConnectedComponent = useCallback(
    (targetLabel: string) => {
      const searchTree = (nodes: ShipTreeNode[]): ShipTreeNode | null => {
        for (const node of nodes) {
          if (node.label === targetLabel) {
            return node;
          }
          if (node.children) {
            const found = searchTree(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const targetNode = searchTree(tree);
      if (!targetNode) return;
      if (isNodeInNonSelectableSection(targetNode)) return;
      setSelectedStructureNode(targetNode);
    },
    [tree]
  );

  return (
    <div className="flex h-full w-full min-h-0 gap-0">
      <div
        className={`"flex h-full min-h-0 shrink-0 flex-col" w-[${MAX_WIDTH_PX}px]`}
        
      >
        <OntologyExplorer
          tree={tree}
          visibleNodeIds={visibleNodeIds}
          onToggleSectionVisible={setSectionVisible}
          onSelect={handleSelectNode}
          selectedNodeId={selectedStructureNode?.id ?? null}
          isLoading={modelTree === null}
        />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <SceneErrorFallback
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-900 text-gray-400">
              <p>Scene failed to load.</p>
              <p className="text-sm">
                Add a ship model at{" "}
                <code className="rounded bg-gray-800 px-1">public/ship/</code>
              </p>
            </div>
          }
        >
          <Scene>
            <Ship
              modelPath={renderedModelPath}
              selectedStructureNode={selectedStructureNode}
              hoveredStructureNode={hoveredStructureNode}
              hiddenNodeIds={hiddenNodeIds}
              onModelTreeLoaded={handleModelTreeLoaded}
              tree={tree}
              onHover={handleHover}
              onSelectByClick={handleSelectByClick}
              onAssemblyPointsSampled={setAssemblyTargets}
              isShipVisible={loading.isShipVisible}
              isInteractive={loading.isInteractive}
            />
            {(loading.isRingVisible || IS_SCENE_INSPECTOR_ENABLED) && (
              <SceneErrorFallback fallback={null}>
                <LoadingRing
                  phase={loading.phase}
                  assemblyTargets={assemblyTargets}
                  onControlsReady={setRingControls}
                />
              </SceneErrorFallback>
            )}
            <SceneInspector ringControls={ringControls} />
          </Scene>
        </SceneErrorFallback>
        {IS_MODEL_VARIANT_TOGGLE_ENABLED && isDefaultModel && (
          <ModelVariantToggle
            value={modelVariant}
            onChange={setModelVariant}
            isLoading={modelTree === null}
          />
        )}
        <SelectionDetailsModal
          selectedNode={selectedStructureNode}
          onClose={() => setSelectedStructureNode(null)}
          onSelectConnectedComponent={handleSelectConnectedComponent}
        />
      </div>
    </div>
  );
}
