"use client";

import { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { SHIP_TREE_SECTION_MAX_HEIGHT_PX } from "@/features/ship-visualizer/ship-visualizer-config";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { useState } from "react";

const SHIP_MODEL_SECTION_ID = "ship-model" as const;

const ONTOLOGY_COLOR_CLASSES = [
  "bg-ontology-1",
  "bg-ontology-2",
  "bg-ontology-3",
  "bg-ontology-4",
  "bg-ontology-5",
] as const;

function getCategoryColorClass(categoryIndex: number): string {
  return ONTOLOGY_COLOR_CLASSES[categoryIndex % ONTOLOGY_COLOR_CLASSES.length];
}

type Props = {
  node: ShipTreeNode;
  depth: number;
  categoryIndex: number;
  getIsVisible: (nodeId: string) => boolean;
  opacity: number;
  onToggleSectionVisible: (node: ShipTreeNode, visible: boolean) => void;
  onOpacityChange: (nodeId: string, value: number) => void;
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
};

export default function TreeNode({
  node,
  depth,
  categoryIndex,
  getIsVisible,
  opacity,
  onToggleSectionVisible,
  onOpacityChange,
  onSelect,
  selectedNodeId,
}: Props) {
  const [isExpandedInternal, setIsExpandedInternal] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const isVisible = getIsVisible(node.id);
  const colorClass = getCategoryColorClass(categoryIndex);
  const isShipModelSection = node.id === SHIP_MODEL_SECTION_ID;
  const isExpanded = isShipModelSection ? true : isExpandedInternal;

  return (
    <div
      className={cn(
        "select-none rounded-md",
        isSelected && "bg-sidebar-accent"
      )}
    >
      <div
        data-node-id={node.id}
        className={cn(
          "flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-primary",
          isVisible
            ? "cursor-pointer hover:bg-sidebar-accent"
            : "cursor-not-allowed opacity-50 text-text-tertiary"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (hasChildren && !isShipModelSection)
            setIsExpandedInternal((e) => !e);
          if (isVisible) onSelect?.(node);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex shrink-0 items-center justify-center border-0 bg-transparent p-0 text-text-tertiary hover:text-text-primary"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              if (!isShipModelSection)
                setIsExpandedInternal((e2) => !e2);
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span
          className={cn("size-2 shrink-0 rounded-full", colorClass)}
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            hasChildren ? "font-semibold" : "font-normal"
          )}
        >
          {node.label}
        </span>
        {hasChildren && !isShipModelSection && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-primary hover:bg-primary/10"
            aria-label={isVisible ? "Hide section" : "Show section"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSectionVisible(node, !isVisible);
            }}
          >
            {isVisible ? (
              <EyeIcon className="size-4" />
            ) : (
              <EyeOffIcon className="size-4 text-text-tertiary" />
            )}
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <>
          <div
            className={cn(depth === 0 && "min-h-0 overflow-y-auto")}
            style={
              depth === 0
                ? { maxHeight: SHIP_TREE_SECTION_MAX_HEIGHT_PX }
                : undefined
            }
          >
            {node.children!.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                categoryIndex={categoryIndex}
                getIsVisible={getIsVisible}
                opacity={opacity}
                onToggleSectionVisible={onToggleSectionVisible}
                onOpacityChange={onOpacityChange}
                onSelect={onSelect}
                selectedNodeId={selectedNodeId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
