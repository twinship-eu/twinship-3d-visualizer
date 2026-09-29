"use client";

import { ExternalLink, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { relationsOf } from "@/features/ship-visualizer/lib/ontology-relations";
import { RelationTarget, relationKey } from "@/features/ship-visualizer/components/relation-target";
import { getObjectDetailsForNode } from "@/features/ship-visualizer/selection-details";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { ONTOLOGY_LIVE_VALUES } from "./ontology-live-values";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

type DescriptionProps = {
  node: ShipTreeNode;
  /** Opens a related component, by its label. */
  onSelectRelated: (label: string) => void;
  /** Opens this component in the Ontology; omitted where there is no way to it. */
  onOpenInOntology?: () => void;
};

/**
 * What the ontology says of a component, in Live data: its description, and
 * its relations to the rest of the ship — each one opening the other end —
 * with the way back to it in the Ontology.
 */
export function OntologyDescription({ node, onSelectRelated, onOpenInOntology }: DescriptionProps) {
  const { description } = getObjectDetailsForNode(node);
  const relations = relationsOf(node);

  return (
    <div className="flex flex-col gap-5 px-6 py-5 text-sm">
      <p className="leading-[1.5] text-ink-2">{description}</p>
      {relations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL_CLASS}>RELATIONS IN THE KNOWLEDGE GRAPH</h3>
          {relations.map((relation) => {
            const { partLabel } = relation;
            const content = (
              <>
                <span className="w-32 shrink-0 font-mono text-[11px] text-muted" title={relation.predicate}>
                  {relation.relation} →
                </span>
                <RelationTarget relation={relation} />
              </>
            );
            const rowClass = "flex items-center gap-3 rounded-lg border border-line bg-card px-3.5 py-2.5 text-left";
            return partLabel ? (
              <button
                key={relationKey(relation)}
                type="button"
                onClick={() => onSelectRelated(partLabel)}
                className={cn(rowClass, "cursor-pointer hover:border-accent-line")}
              >
                {content}
              </button>
            ) : (
              <div key={relationKey(relation)} className={rowClass}>
                {content}
              </div>
            );
          })}
        </section>
      )}
      {onOpenInOntology && (
        <button
          type="button"
          onClick={onOpenInOntology}
          className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-accent-line text-sm font-semibold text-accent-ink hover:bg-accent-soft"
        >
          <Network className="size-4" aria-hidden />
          Open in the Ontology
        </button>
      )}
    </div>
  );
}

type ParametersProps = { node: ShipTreeNode; snapshot: LiveSnapshot | null };

/**
 * A component's parameters in the ontology, each linked to its definition —
 * and, where the ship's data measures it, its live reading beside it.
 */
export function OntologyParameters({ node, snapshot }: ParametersProps) {
  const { parameters } = getObjectDetailsForNode(node);
  const liveValues: Partial<Record<string, (snapshot: LiveSnapshot) => string>> = ONTOLOGY_LIVE_VALUES[node.label] ?? {};

  if (parameters.length === 0) return <p className="px-6 py-5 text-sm text-muted">No parameters in the ontology yet.</p>;

  return (
    <dl className="px-6 py-3 text-sm">
      {parameters.map((parameter) => {
        const live = liveValues[parameter.property ?? parameter.name];
        return (
          <div key={parameter.property ?? parameter.name} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
            <dt className="min-w-0 text-ink-2">
              {parameter.href ? (
                <a
                  href={parameter.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent-ink hover:text-accent"
                  aria-label={`${parameter.name} (opens in new tab)`}
                >
                  {parameter.name}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              ) : (
                parameter.name
              )}
            </dt>
            <dd className="flex shrink-0 flex-col items-end text-right">
              {live && snapshot ? (
                <span className="flex items-center gap-1.5 font-mono font-semibold">
                  <span className="rounded bg-ok-soft px-1 font-sans text-[10px] font-bold tracking-[0.06em] text-ok">LIVE</span>
                  {live(snapshot)}
                </span>
              ) : (
                !parameter.value && <span className="font-semibold">—</span>
              )}
              {parameter.value && <span className="font-semibold">{parameter.value}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
