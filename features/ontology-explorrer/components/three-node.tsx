"use client";

import { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { SHIP_TREE_SECTION_MAX_HEIGHT_PX } from "@/features/ship-visualizer/ship-visualizer-config";
import { getSectionDotClass } from "@/features/ship-visualizer/lib/section-colors";
import { cn } from "@/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";

const SHIP_MODEL_SECTION_ID = "ship-model" as const;

type Props = {
  node: ShipTreeNode;
  depth: number;
  /** The top-level section this node is under: its colour. */
  sectionId: string;
  getIsVisible: (nodeId: string) => boolean;
  opacity: number;
  onToggleSectionVisible: (node: ShipTreeNode, visible: boolean) => void;
  onOpacityChange: (nodeId: string, value: number) => void;
  onSelect?: (node: ShipTreeNode) => void;
  selectedNodeId?: string | null;
  /** What the row shows beside its label: e.g. its live reading. */
  renderReading?: (node: ShipTreeNode) => React.ReactNode;
};

/**
 * A row of the ontology tree, as the cockpit design draws it: sections in
 * bold with their system's dot and an eye to hide them, components indented
 * under them. The sections stay open — the tree is short enough to see whole.
 */
export default function TreeNode({
  node,
  depth,
  sectionId,
  getIsVisible,
  opacity,
  onToggleSectionVisible,
  onOpacityChange,
  onSelect,
  selectedNodeId,
  renderReading,
}: Props) {
  const hasChildren = node.children && node.children.length > 0;
  const isSection = depth === 0;
  const isSelected = selectedNodeId === node.id;
  const isVisible = getIsVisible(node.id);
  const isShipModelSection = node.id === SHIP_MODEL_SECTION_ID;

  return (
    <div className={cn("select-none", isSection && "mt-1 first:mt-0")}>
      <div
        data-node-id={node.id}
        className={cn(
          "flex h-[26px] items-center gap-2 rounded-md text-[13px]",
          isSection ? "px-1.5 font-semibold text-ink" : "pr-1.5 pl-[22px] text-ink-2",
          isSelected && "bg-accent-soft font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-accent-line)]",
          isVisible ? "cursor-pointer hover:bg-btn" : "cursor-not-allowed opacity-50"
        )}
        onClick={() => {
          if (isVisible) onSelect?.(node);
        }}
      >
        <span
          className={cn("shrink-0 rounded-full", isSection ? "size-[7px]" : "size-1.5", getSectionDotClass(sectionId))}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        {renderReading?.(node)}
        {hasChildren && !isShipModelSection && (
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded p-0.5 text-eye hover:bg-btn"
            aria-label={isVisible ? `Hide ${node.label}` : `Show ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSectionVisible(node, !isVisible);
            }}
          >
            {isVisible ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4 text-muted" />}
          </button>
        )}
      </div>
      {hasChildren && (
        <div
          className={cn(isSection && "min-h-0 overflow-y-auto")}
          style={isSection ? { maxHeight: SHIP_TREE_SECTION_MAX_HEIGHT_PX } : undefined}
        >
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              sectionId={sectionId}
              getIsVisible={getIsVisible}
              opacity={opacity}
              onToggleSectionVisible={onToggleSectionVisible}
              onOpacityChange={onOpacityChange}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
              renderReading={renderReading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
