"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ShipSearchPanel } from "./components/ship-search-panel";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import {
  SHIP_VISUALIZER_LAYOUT,
  DEFAULT_SHIP_MODEL_PATH,
} from "./ship-visualizer-config";
import type { ShipTreeNode } from "./ship-visualizer-types";

const ShipScene = dynamic(
  () =>
    import("./components/ship-scene").then((mod) => ({ default: mod.ShipScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-900 text-gray-400">
        Loading scene…
      </div>
    ),
  }
);

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

  const handleModelTreeLoaded = useCallback((tree: ShipTreeNode[]) => {
    setModelTree([SHIP_MODEL_SECTION, ...tree]);
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

  const tree = modelTree ?? MOCK_SHIP_TREE;

  return (
    <div className="flex h-full w-full min-h-0 gap-0">
      <div
        className="flex h-full min-h-0 shrink-0 flex-col"
        style={{ width: MAX_WIDTH_PX, maxWidth: "100%" }}
      >
        <ShipSearchPanel
          tree={tree}
          onSelect={handleSelectNode}
          selectedNodeId={selectedStructureNode?.id ?? null}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
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
          <ShipScene
            className="h-full w-full min-h-0"
            modelPath={selectedModelPath}
            selectedStructureNode={selectedStructureNode}
            hoveredStructureNode={hoveredStructureNode}
            onModelTreeLoaded={handleModelTreeLoaded}
            tree={tree}
            onHover={handleHover}
            onSelectByClick={handleSelectByClick}
          />
        </SceneErrorFallback>
      </div>
    </div>
  );
}
