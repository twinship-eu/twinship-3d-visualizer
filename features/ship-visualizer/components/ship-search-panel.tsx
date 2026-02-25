"use client";

import { useState, useMemo } from "react";
import { SearchIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filterShipTree } from "../lib/filter-tree";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { SHIP_VISUALIZER_LAYOUT } from "../ship-visualizer-config";
import { cn } from "@/lib/utils";

const MAX_WIDTH = SHIP_VISUALIZER_LAYOUT.MAX_LEFT_PANEL_WIDTH_PX;

type Props = {
  tree: ShipTreeNode[];
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
};

function TreeNode({
  node,
  depth,
  onSelect,
  selectedNodeId,
}: {
  node: ShipTreeNode;
  depth: number;
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.id;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
          "text-sm text-gray-700 dark:text-gray-300",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) setIsExpanded((e) => !e);
          onSelect?.(node);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0 border-0 bg-transparent cursor-pointer flex items-center justify-center"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((e2) => !e2);
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon className="size-4 shrink-0" />
            ) : (
              <ChevronRightIcon className="size-4 shrink-0" />
            )}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ShipSearchPanel({ tree, onSelect, selectedNodeId }: Props) {
  const [search, setSearch] = useState("");
  const filteredTree = useMemo(() => filterShipTree(tree, search), [tree, search]);

  return (
    <div
      className="flex h-full min-h-0 w-full max-w-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      style={{ maxWidth: MAX_WIDTH }}
    >
      <div className="shrink-0 border-b border-gray-200 p-2 dark:border-gray-800">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Ship structure
        </h2>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full min-w-0 bg-white dark:bg-gray-800"
          icon={<SearchIcon className="size-4" />}
          iconPosition="left"
          aria-label="Search ship data tree"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {filteredTree.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No matches</p>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
            />
          ))
        )}
      </div>
    </div>
  );
}
