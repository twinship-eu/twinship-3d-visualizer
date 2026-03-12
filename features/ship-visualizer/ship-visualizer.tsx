"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Scene } from "@/features/3d-scene/3d-scene";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import Ship from "./components/scene-content";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import { mapModelTreeToSections } from "./lib/map-tree-to-sections";
import { collectNodeIds } from "./lib/filter-tree";
import {
  SHIP_VISUALIZER_LAYOUT,
  DEFAULT_SHIP_MODEL_PATH,
} from "./ship-visualizer-config";
import type { ShipTreeNode } from "./ship-visualizer-types";
import { OntologyExplorer } from "../ontology-explorrer/ontology-explorer";
import { SelectionDetailsModal } from "./components/selection-details-modal";

const MAX_WIDTH_PX = SHIP_VISUALIZER_LAYOUT.MAX_LEFT_PANEL_WIDTH_PX;

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

  useEffect(() => {
    setModelTree(null);
  }, [selectedModelPath]);

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
    const sectioned = mapModelTreeToSections(tree);
    setModelTree([SHIP_MODEL_SECTION, ...sectioned]);
    setSelectedStructureNode(null);
  }, []);

  const handleSelectNode = useCallback((node: ShipTreeNode) => {
    if (node.modelPath) {
      setSelectedModelPath(node.modelPath);
      return;
    }
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
              modelPath={selectedModelPath}
              selectedStructureNode={selectedStructureNode}
              hoveredStructureNode={hoveredStructureNode}
              hiddenNodeIds={hiddenNodeIds}
              onModelTreeLoaded={handleModelTreeLoaded}
              tree={tree}
              onHover={handleHover}
              onSelectByClick={handleSelectByClick}
            />
          </Scene>
        </SceneErrorFallback>
        <SelectionDetailsModal
          selectedNode={selectedStructureNode}
          onClose={() => setSelectedStructureNode(null)}
        />
      </div>
    </div>
  );
}
