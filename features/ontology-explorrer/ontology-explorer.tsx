"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { SearchIcon, X } from "lucide-react";
import { ShipTreeNode } from "../ship-visualizer/ship-visualizer-types";
import { filterShipTree } from "../ship-visualizer/lib/filter-tree";
import TreeNode from "./components/three-node";
import { OntologyExplorerSkeleton } from "./components/ontology-explorer-skeleton";
import { getSectionIdOf } from "../ship-visualizer/lib/section-colors";


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
  /** Shown at the panel's foot, under the tree: e.g. a live warning. */
  footer?: React.ReactNode;
  /** What each row shows beside its label: e.g. its live reading. */
  renderReading?: (node: ShipTreeNode) => React.ReactNode;
};

export function OntologyExplorer({
  tree,
  visibleNodeIds,
  onToggleSectionVisible,
  onSelect,
  selectedNodeId,
  isLoading = false,
  onClose,
  footer,
  renderReading,
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
    <div className="flex h-full min-h-0 w-full flex-col border-r border-line bg-surface">
      <div className="shrink-0 px-3.5 pt-3.5 pb-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="ontology-search" className="text-[11px] font-semibold tracking-[0.12em] text-muted">
            ONTOLOGY EXPLORER
          </label>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close components panel"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex h-[34px] items-center gap-2 rounded-lg border border-line bg-card px-2.5 focus-within:border-accent-line">
          <SearchIcon className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            id="ontology-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components…"
            className="min-w-0 grow border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
            aria-label="Search ship components"
          />
        </div>
      </div>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filteredTree.length === 0 ? (
          <p className="px-1.5 text-[13px] text-muted">No matches</p>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              sectionId={getSectionIdOf(node)}
              getIsVisible={isVisible}
              opacity={getOpacity(node.id)}
              onToggleSectionVisible={onToggleSectionVisible}
              onOpacityChange={setOpacity}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
              renderReading={renderReading}
            />
          ))
        )}
      </div>
      {footer && <div className="flex min-h-0 shrink-0 flex-col">{footer}</div>}
    </div>
  );
}
