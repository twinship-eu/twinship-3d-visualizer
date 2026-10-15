import { cn } from "@/lib/utils";
import type { OntologyRelation } from "../lib/ontology-relations";
import { getSectionDotClass } from "../lib/section-colors";

/** A relation's key among a component's: its predicate and its other end. */
export const relationKey = (relation: OntologyRelation) => `${relation.relation}-${relation.label}`;

/**
 * A relation's other end: a 3D part, with its section's dot, or what the
 * knowledge graph has with no part in the model, by its class — and the
 * graph's instances either way, for who knows them by their IDs.
 */
export function RelationTarget({ relation, className }: { relation: OntologyRelation; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
        <span
          className={cn(
            "size-[7px] shrink-0 rounded-full",
            relation.sectionId ? getSectionDotClass(relation.sectionId) : "border border-muted"
          )}
          aria-hidden
        />
        <span className="truncate">{relation.label}</span>
      </span>
      <span
        className="truncate font-mono text-[11px] font-normal text-muted"
        title={relation.partLabel ? undefined : "In the knowledge graph, with no part of its own in the 3D model"}
      >
        {relation.instanceIds.join(", ")}
        {!relation.partLabel && " · no 3D part"}
      </span>
    </span>
  );
}
