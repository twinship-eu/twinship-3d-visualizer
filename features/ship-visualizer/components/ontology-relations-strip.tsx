"use client";

import { cn } from "@/lib/utils";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { getObjectDetailsForNode } from "../selection-details";
import { getSectionDotClass, getSectionIdOf } from "../lib/section-colors";
import { SHIP_TREE_SECTIONS } from "../ship-visualizer-config";
import type { ShipTreeNode } from "../ship-visualizer-types";

/** A connection with no relation of its own named in the ontology. */
const DEFAULT_RELATION = "connectedTo";

type Relation = { relation: string; label: string; sectionId: string };

type Props = {
  selectedNode: ShipTreeNode;
  /** Jumps to a related component, by its label. */
  onSelectRelated: (label: string) => void;
  /** Opens the component's sensors in Live data. */
  onShowSensors: () => void;
};

/** The node's relations: the section it is part of, then its connections. */
function relationsOf(node: ShipTreeNode): Relation[] {
  const sectionId = getSectionIdOf(node);
  const section = SHIP_TREE_SECTIONS.find((candidate) => candidate.id === sectionId);
  // A section is part of nothing: only its components are
  const partOf: Relation[] =
    section && section.id !== node.id ? [{ relation: "partOf", label: section.label, sectionId: section.id }] : [];
  const connections = getObjectDetailsForNode(node).connectedComponents.map((component) => ({
    relation: component.relation ?? DEFAULT_RELATION,
    label: component.label,
    sectionId: getSectionIdOf({ id: component.id, label: component.label }),
  }));

  return [...partOf, ...connections];
}

const CARD_CLASS =
  "flex min-w-[180px] flex-col justify-center gap-1.5 rounded-[10px] bg-card px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Under the scene, in Ontology: how the selected component relates to the
 * rest of the ship — each relation a card that jumps to the other end, and
 * its sensors, shown in Live data.
 */
export function OntologyRelationsStrip({ selectedNode, onSelectRelated, onShowSensors }: Props) {
  const sensorCount = useLiveData()?.sensorCounts[selectedNode.label] ?? 0;
  const relations = relationsOf(selectedNode);

  return (
    <section
      aria-label={`${selectedNode.label} relations in the ontology`}
      className="hidden h-[170px] shrink-0 flex-col gap-2.5 border-t border-line bg-surface px-4 py-3.5 lg:flex"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("size-[7px] rounded-full", getSectionDotClass(getSectionIdOf(selectedNode)))} aria-hidden />
        <span className="font-bold">{selectedNode.label} · relations in the ontology</span>
        <span className="text-muted">click a related component to jump to it</span>
      </div>
      <div className="grid min-h-0 grow auto-cols-[minmax(180px,1fr)] grid-flow-col gap-3 overflow-x-auto">
        {relations.map(({ relation, label, sectionId }) => (
          <button
            key={`${relation}-${label}`}
            type="button"
            onClick={() => onSelectRelated(label)}
            className={cn(CARD_CLASS, "cursor-pointer border border-line hover:border-accent-line")}
          >
            <span className="font-mono text-[11px] text-muted">{relation} →</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span className={cn("size-[7px] shrink-0 rounded-full", getSectionDotClass(sectionId))} aria-hidden />
              <span className="truncate">{label}</span>
            </span>
          </button>
        ))}
        {sensorCount > 0 && (
          <button
            type="button"
            onClick={onShowSensors}
            className={cn(CARD_CLASS, "cursor-pointer border border-dashed border-line-strong hover:border-accent-line")}
          >
            <span className="font-mono text-[11px] text-muted">hasSensor →</span>
            <span className="text-sm font-semibold">
              {sensorCount} sensor{sensorCount === 1 ? "" : "s"}{" "}
              <span className="font-normal text-muted">· shown in Live</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
