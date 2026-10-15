"use client";

import { cn } from "@/lib/utils";
import { OntologyExplorer } from "../../ontology-explorrer/ontology-explorer";
import { SIDEBAR_WIDTH_CLASS } from "../ship-visualizer-config";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { SidebarToggleButton } from "./sidebar-toggle-button";

type Props = {
  /** Below lg, whether the overlay is open, and whether its button is offered. */
  isOpen: boolean;
  hasToggle: boolean;
  onOpen: () => void;
  onClose: () => void;
  tree: ShipTreeNode[];
  isLoading: boolean;
  visibleNodeIds: Record<string, boolean>;
  onToggleSectionVisible: (node: ShipTreeNode, visible: boolean) => void;
  onSelect: (node: ShipTreeNode) => void;
  selectedNodeId: string | null;
  footer: React.ReactNode;
  renderReading?: (node: ShipTreeNode) => React.ReactNode;
};

/**
 * The ontology tree: docked beside the scene at lg, an overlay behind its
 * button below it, with a backdrop that closes it.
 */
export function ShipSidebar({ isOpen, hasToggle, onOpen, onClose, onSelect, ...explorer }: Props) {
  return (
    <>
      {/* Dims the scene while the overlay is open, and closes it on tap. At lg it never covers anything */}
      {isOpen && <div className="absolute inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      {hasToggle && <SidebarToggleButton isOpen={isOpen} onOpen={onOpen} />}
      <div
        className={cn(
          // Below lg: an overlay that slides in from the left over the scene.
          "absolute inset-y-0 left-0 z-50 flex min-h-0 shrink-0 flex-col",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // At lg: back to a static docked column, always visible.
          "lg:relative lg:z-auto lg:translate-x-0 lg:transition-none",
          SIDEBAR_WIDTH_CLASS
        )}
      >
        <OntologyExplorer
          {...explorer}
          onSelect={(node) => {
            onSelect(node);
            onClose();
          }}
          onClose={onClose}
        />
      </div>
    </>
  );
}
