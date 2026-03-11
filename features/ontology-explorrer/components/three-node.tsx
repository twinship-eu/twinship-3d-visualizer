"use client";

import { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
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
  isSectionVisible: boolean;
  opacity: number;
  onToggleVisible: (nodeId: string, visible: boolean) => void;
  onOpacityChange: (nodeId: string, value: number) => void;
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
};

export default function TreeNode({
  node,
  depth,
  categoryIndex,
  isSectionVisible,
  opacity,
  onToggleVisible,
  onOpacityChange,
  onSelect,
  selectedNodeId,
}: Props) {
  const [isExpandedInternal, setIsExpandedInternal] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
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
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-sidebar-accent",
          "text-sm text-text-primary",
          !isSectionVisible && "opacity-50 text-text-tertiary"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (hasChildren && !isShipModelSection)
            setIsExpandedInternal((e) => !e);
          onSelect?.(node);
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
            aria-label={isSectionVisible ? "Hide section" : "Show section"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(node.id, !isSectionVisible);
            }}
          >
            {isSectionVisible ? (
              <EyeIcon className="size-4" />
            ) : (
              <EyeOffIcon className="size-4 text-text-tertiary" />
            )}
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <>
          {depth === 0 && !isShipModelSection && (
            <div
              className="mb-1 mt-0.5 px-2 py-1"
              style={{ paddingLeft: `${14 + 8}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-primary">
                Opacity
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={(e) =>
                    onOpacityChange(node.id, Number(e.target.value))
                  }
                  className="h-1.5 flex-1 appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-primary"
                  style={{
                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${opacity}%, var(--border) ${opacity}%, var(--border) 100%)`,
                  }}
                  aria-label="Opacity"
                />
                <span className="w-8 shrink-0 text-right text-sm font-medium text-text-primary">
                  {opacity}%
                </span>
              </div>
            </div>
          )}
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              categoryIndex={categoryIndex}
              isSectionVisible={isSectionVisible}
              opacity={opacity}
              onToggleVisible={onToggleVisible}
              onOpacityChange={onOpacityChange}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </>
      )}
    </div>
  );
}
