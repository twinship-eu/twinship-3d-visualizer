"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { SearchIcon, Ship, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ShipTreeNode } from "../ship-visualizer/ship-visualizer-types";
import { filterShipTree } from "../ship-visualizer/lib/filter-tree";
import TreeNode from "./components/three-node";
import { OntologyExplorerSkeleton } from "./components/ontology-explorer-skeleton";


type Props = {
  tree: ShipTreeNode[];
  visibleNodeIds: Record<string, boolean>;
  onToggleSectionVisible: (node: ShipTreeNode, visible: boolean) => void;
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
  /** When true, show skeleton instead of tree (e.g. while ship model is loading). */
  isLoading?: boolean;
  /**
   * Dismisses the panel. Only supplied below the desktop breakpoint, where the
   * panel is an overlay; a docked column has nothing to dismiss.
   */
  onClose?: () => void;
};

export function OntologyExplorer({
  tree,
  visibleNodeIds,
  onToggleSectionVisible,
  onSelect,
  selectedNodeId,
  isLoading = false,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
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
  const setOpacity = useCallback((nodeId: string, value: number) => {
    setOpacityByNodeId((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedNodeId || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(
      `[data-node-id="${selectedNodeId}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedNodeId]);

  if (isLoading) {
    return <OntologyExplorerSkeleton />;
  }

  return (
    /*
      Width is set by the parent, which owns whether this is a docked column or
      an overlay. The interpolated max-width class that used to sit here was
      never emitted by Tailwind: utilities are found by scanning source text, so
      a class assembled from a variable at runtime does not exist in the CSS.
    */
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border bg-white dark:bg-sidebar">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          {/*
            Spacer that balances the close button, so the title stays optically
            centred whether or not the button is there.
          */}
          {onClose && <span className="size-8 shrink-0 lg:hidden" aria-hidden />}
          <div className="flex flex-1 items-center justify-center gap-2">
            <Ship className="size-5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">
              Ontology Explorer
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close components panel"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
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
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {filteredTree.length === 0 ? (
          <p className="text-sm text-text-tertiary">No matches</p>
        ) : (
          filteredTree.map((node, index) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              categoryIndex={index}
              getIsVisible={isVisible}
              opacity={getOpacity(node.id)}
              onToggleSectionVisible={onToggleSectionVisible}
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
