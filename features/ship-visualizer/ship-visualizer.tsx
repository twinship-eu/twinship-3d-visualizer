"use client";

import { useState, useCallback, useEffect } from "react";
import { Scene } from "@/features/3d-scene/3d-scene";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import Ship from "./components/scene-content";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import {
  SHIP_VISUALIZER_LAYOUT,
  DEFAULT_SHIP_MODEL_PATH,
} from "./ship-visualizer-config";
import type { ShipTreeNode } from "./ship-visualizer-types";
import { OntologyExplorer } from "../ontology-explorrer/ontology-explorer";

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
        <OntologyExplorer
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
          <Scene>
            <Ship
              modelPath={selectedModelPath}
              selectedStructureNode={selectedStructureNode}
              hoveredStructureNode={hoveredStructureNode}
              onModelTreeLoaded={handleModelTreeLoaded}
              tree={tree}
              onHover={handleHover}
              onSelectByClick={handleSelectByClick}
            />
          </Scene>
        </SceneErrorFallback>
      </div>
    </div>
  );
}
