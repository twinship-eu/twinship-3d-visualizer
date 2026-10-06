"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { relationsOf } from "@/features/ship-visualizer/lib/ontology-relations";
import { getSectionDotClass } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

type Props = {
  node: ShipTreeNode;
  /** Opens a connected component, by its label. */
  onSelect: (label: string) => void;
};

/**
 * The components a component is connected to, in the knowledge graph — those
 * the ship has in 3D — each opening it, as in the Ontology's card: shown in
 * Live data too, with an alarm or without.
 */
export function ConnectedComponents({ node, onSelect }: Props) {
  const connected = relationsOf(node).filter((relation) => relation.partLabel);
  if (connected.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className={SECTION_LABEL_CLASS}>CONNECTED COMPONENTS ({connected.length})</h3>
      {connected.map((relation) => {
        const label = relation.partLabel ?? relation.label;
        const section = SHIP_TREE_SECTIONS.find((candidate) => candidate.id === relation.sectionId);
        return (
          <button
            key={`${relation.relation}-${label}`}
            type="button"
            onClick={() => onSelect(label)}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-card px-3.5 py-2.5 text-left hover:border-accent-line"
          >
            <span className={cn("size-2 shrink-0 rounded-full", getSectionDotClass(relation.sectionId ?? ""))} aria-hidden />
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate font-semibold">{label}</span>
              {section && <span className="truncate text-xs text-muted">{section.label}</span>}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted" title={relation.predicate}>
              {relation.relation}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
        );
      })}
    </section>
  );
}
