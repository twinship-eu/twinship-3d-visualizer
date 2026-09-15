"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Scene } from "@/features/3d-scene/3d-scene";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import Ship from "./components/scene-content";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import {
  isNodeInNonSelectableSection,
  mapModelTreeToSections,
} from "./lib/map-tree-to-sections";
import { collectNodeIds } from "./lib/filter-tree";
import {
  SIDEBAR_WIDTH_CLASS,
  DEFAULT_SHIP_MODEL_PATH,
} from "./ship-visualizer-config";
import { SidebarToggleButton } from "./components/sidebar-toggle-button";
import { cn } from "@/lib/utils";
import type { ShipTreeNode } from "./ship-visualizer-types";
import { OntologyExplorer } from "../ontology-explorrer/ontology-explorer";
import { SelectionDetailsModal } from "./components/selection-details-modal";
import { LoadingRing } from "@/features/3d-scene/components/loading-ring";
import { useModelLoadProgress } from "./hooks/use-model-load-progress";

const SHIP_MODEL_SECTION = MOCK_SHIP_TREE[0];

export function ShipVisualizer() {
  const [selectedModelPath, setSelectedModelPath] =
    useState(DEFAULT_SHIP_MODEL_PATH);
  /**
   * Only meaningful below `lg`, where the sidebar is an overlay. At `lg` and
   * above the panel is statically docked and this is ignored.
   */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedStructureNode, setSelectedStructureNode] =
    useState<ShipTreeNode | null>(null);
  const [hoveredStructureNode, setHoveredStructureNode] =
    useState<ShipTreeNode | null>(null);
  const [modelTree, setModelTree] = useState<ShipTreeNode[] | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<
    Record<string, boolean>
  >({});
  const isModelReady = modelTree !== null;
  const [assemblyTargets, setAssemblyTargets] = useState<Float32Array | null>(
    null
  );
  const loading = useModelLoadProgress(isModelReady, assemblyTargets !== null);

  const renderedModelPath = selectedModelPath;

  useEffect(() => {
    setModelTree(null);
  }, [renderedModelPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return;
      }
      if (selectedStructureNode !== null) {
        setSelectedStructureNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStructureNode, isSidebarOpen]);

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
    <div className="relative flex h-full w-full min-h-0 gap-0">
      {/*
        Dims the scene while the overlay sidebar is open, and closes it on tap.
        `lg:hidden` because above the breakpoint the sidebar never covers
        anything and there is nothing to dismiss.
      */}
      {isSidebarOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      <SidebarToggleButton
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((open) => !open)}
      />

      <div
        className={cn(
          // Below lg: an overlay that slides in from the left over the scene.
          "absolute inset-y-0 left-0 z-40 flex min-h-0 shrink-0 flex-col",
          "transition-transform duration-300 ease-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          // At lg: back to a static docked column, always visible.
          "lg:relative lg:z-auto lg:translate-x-0 lg:transition-none",
          SIDEBAR_WIDTH_CLASS
        )}
      >
        <OntologyExplorer
          tree={tree}
          visibleNodeIds={visibleNodeIds}
          onToggleSectionVisible={setSectionVisible}
          onSelect={(node) => {
            handleSelectNode(node);
            setIsSidebarOpen(false);
          }}
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
              isInteractive={loading.isInteractive}
            />
            {loading.isRingVisible && (
              <SceneErrorFallback fallback={null}>
                <LoadingRing
                  phase={loading.phase}
                  assemblyTargets={assemblyTargets}
                />
              </SceneErrorFallback>
            )}
          </Scene>
        </SceneErrorFallback>
        <SelectionDetailsModal
          selectedNode={selectedStructureNode}
          onClose={() => setSelectedStructureNode(null)}
          onSelectConnectedComponent={handleSelectConnectedComponent}
        />
      </div>
    </div>
  );
}
