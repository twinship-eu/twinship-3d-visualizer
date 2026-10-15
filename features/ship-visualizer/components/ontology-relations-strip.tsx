"use client";

import { cn } from "@/lib/utils";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { KNOWLEDGE_GRAPH } from "../lib/knowledge-graph";
import { relationsOf } from "../lib/ontology-relations";
import { getSectionDotClass, getSectionIdOf } from "../lib/section-colors";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { RelationTarget, relationKey } from "./relation-target";

type Props = {
  selectedNode: ShipTreeNode;
  /** Jumps to a related component, by its label. */
  onSelectRelated: (label: string) => void;
  /** Opens the component's sensors in Live data. */
  onShowSensors: () => void;
};

const CARD_CLASS =
  "flex min-w-[180px] flex-col justify-center gap-1.5 rounded-[10px] bg-card px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Under the scene, in Ontology: how the selected component relates to the
 * rest of the ship, as the knowledge graph has it — each relation a card,
 * jumping to the other end when the model has it — and its sensors, shown in
 * Live data.
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
        <span className="text-muted">
          {relations.length > 0
            ? `from the knowledge graph (${KNOWLEDGE_GRAPH.source.pipeline}) · click a 3D part to jump to it`
            : "not in the knowledge graph yet: no relations to show"}
        </span>
      </div>
      <div className="grid min-h-0 grow auto-cols-[minmax(200px,1fr)] grid-flow-col gap-3 overflow-x-auto">
        {relations.map((relation) => {
          const { partLabel } = relation;
          const content = (
            <>
              <span className="font-mono text-[11px] text-muted" title={relation.predicate}>
                {relation.relation} →
              </span>
              <RelationTarget relation={relation} className="text-sm" />
            </>
          );
          return partLabel ? (
            <button
              key={relationKey(relation)}
              type="button"
              onClick={() => onSelectRelated(partLabel)}
              className={cn(CARD_CLASS, "cursor-pointer border border-line hover:border-accent-line")}
            >
              {content}
            </button>
          ) : (
            <div key={relationKey(relation)} className={cn(CARD_CLASS, "border border-line")}>
              {content}
            </div>
          );
        })}
        {sensorCount > 0 && (
          <button
            type="button"
            onClick={onShowSensors}
            className={cn(CARD_CLASS, "cursor-pointer border border-dashed border-line-strong hover:border-accent-line")}
          >
            {/* Not a relation of the ontology: the sample sensor catalogue's, in Live data */}
            <span className="font-mono text-[11px] text-muted">sensors →</span>
            <span className="text-sm font-semibold">
              {sensorCount} sensor{sensorCount === 1 ? "" : "s"}{" "}
              <span className="font-normal text-muted">· sample, shown in Live</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
