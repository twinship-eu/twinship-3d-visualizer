"use client";

import { useState, useMemo, useCallback } from "react";
import { SearchIcon, Ship } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ShipTreeNode } from "../ship-visualizer/ship-visualizer-types";
import { filterShipTree } from "../ship-visualizer/lib/filter-tree";
import { SHIP_VISUALIZER_LAYOUT } from "../ship-visualizer/ship-visualizer-config";
import TreeNode from "./components/three-node";

const MAX_WIDTH = SHIP_VISUALIZER_LAYOUT.MAX_LEFT_PANEL_WIDTH_PX;

type Props = {
  tree: ShipTreeNode[];
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
};

export function OntologyExplorer({ tree, onSelect, selectedNodeId }: Props) {
  const [search, setSearch] = useState("");
  const [visibleNodeIds, setVisibleNodeIds] = useState<Record<string, boolean>>(
    () => ({} as Record<string, boolean>)
  );
  const [opacityByNodeId, setOpacityByNodeId] = useState<Record<string, number>>(
    () => ({} as Record<string, number>)
  );

  const filteredTree = useMemo(
    () => filterShipTree(tree, search),
    [tree, search]
  );

  const isVisible = useCallback(
    (nodeId: string) => visibleNodeIds[nodeId] !== false,
    [visibleNodeIds]
  );
  const getOpacity = useCallback(
    (nodeId: string) => opacityByNodeId[nodeId] ?? 100,
    [opacityByNodeId]
  );
  const setVisible = useCallback((nodeId: string, visible: boolean) => {
    setVisibleNodeIds((prev) => ({ ...prev, [nodeId]: visible }));
  }, []);
  const setOpacity = useCallback((nodeId: string, value: number) => {
    setOpacityByNodeId((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  return (
    <div
      className="flex h-full min-h-0 w-full max-w-full flex-col border-r border-border bg-white dark:bg-sidebar"
      style={{ maxWidth: MAX_WIDTH }}
    >
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Ship className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">
            Ontology Explorer
          </h2>
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components..."
          className="w-full min-w-0 border-border bg-white dark:bg-sidebar"
          icon={<SearchIcon className="size-4 text-text-tertiary" />}
          iconPosition="left"
          aria-label="Search ship components"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filteredTree.length === 0 ? (
          <p className="text-sm text-text-tertiary">No matches</p>
        ) : (
          filteredTree.map((node, index) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              categoryIndex={index}
              isSectionVisible={isVisible(node.id)}
              opacity={getOpacity(node.id)}
              onToggleVisible={(id, visible) => setVisible(id, visible)}
              onOpacityChange={setOpacity}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
            />
          ))
        )}
      </div>
    </div>
  );
}
