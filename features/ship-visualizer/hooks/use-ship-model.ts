"use client";

import { useCallback, useMemo, useState } from "react";
import { collectNodeIds } from "../lib/filter-tree";
import { mapModelTreeToSections } from "../lib/map-tree-to-sections";
import { DEFAULT_SHIP_MODEL_PATH } from "../ship-visualizer-config";
import { MOCK_SHIP_TREE } from "../ship-visualizer-mock";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { useModelLoadProgress } from "./use-model-load-progress";

const SHIP_MODEL_SECTION = MOCK_SHIP_TREE[0];

/**
 * The ship's model and its tree: which model is shown, its tree once loaded
 * (the placeholder tree until then), which sections are hidden, and how far
 * its loading has come.
 *
 * @param onModelLoaded called when a model's tree arrives: whatever was
 *   selected in the last one no longer exists
 */
export function useShipModel(onModelLoaded: () => void) {
  const [modelPath, setModelPathState] = useState(DEFAULT_SHIP_MODEL_PATH);
  const [modelTree, setModelTree] = useState<ShipTreeNode[] | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Record<string, boolean>>({});
  const [assemblyTargets, setAssemblyTargets] = useState<Float32Array | null>(null);
  const isModelReady = modelTree !== null;
  const loading = useModelLoadProgress(isModelReady, assemblyTargets !== null);

  /** Shows another model: its tree is unknown until it has loaded. */
  const setModelPath = useCallback(
    (path: string) => {
      if (path === modelPath) return;
      setModelTree(null);
      setModelPathState(path);
    },
    [modelPath]
  );

  const handleModelTreeLoaded = useCallback(
    (tree: ShipTreeNode[]) => {
      const topLevelOnly = tree.map((node) => ({ ...node, children: undefined }));
      setModelTree([SHIP_MODEL_SECTION, ...mapModelTreeToSections(topLevelOnly)]);
      onModelLoaded();
    },
    [onModelLoaded]
  );

  const setSectionVisible = useCallback((node: ShipTreeNode, visible: boolean) => {
    const ids = collectNodeIds(node);
    setVisibleNodeIds((previous) => {
      const next = { ...previous };
      for (const id of ids) next[id] = visible;
      return next;
    });
  }, []);

  const hiddenNodeIds = useMemo(
    () =>
      new Set(
        Object.entries(visibleNodeIds)
          .filter(([, isVisible]) => isVisible === false)
          .map(([id]) => id)
      ),
    [visibleNodeIds]
  );

  return {
    modelPath,
    setModelPath,
    /** The model's tree, or the placeholder while it loads. */
    tree: modelTree ?? MOCK_SHIP_TREE,
    isModelReady,
    visibleNodeIds,
    setSectionVisible,
    hiddenNodeIds,
    assemblyTargets,
    setAssemblyTargets,
    loading,
    handleModelTreeLoaded,
  };
}
