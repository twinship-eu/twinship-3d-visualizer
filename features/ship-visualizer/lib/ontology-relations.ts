import type { ShipTreeNode } from "../ship-visualizer-types";
import { IS_ONLY_RELATIONS_TO_3D_PARTS } from "../ship-knowledge-graph-config";
import { partRelationsOf, type PartRelation } from "./knowledge-graph";
import { getSectionIdOf } from "./section-colors";

/**
 * A component's relation in the ontology, as the screens show it: the
 * knowledge graph's own (see `partRelationsOf`), with the section colour of a
 * 3D part at the other end.
 */
export type OntologyRelation = PartRelation & {
  /** The other end's section, for its dot: only when it is a 3D part. */
  sectionId?: string;
};

/** A component's relations, from the knowledge graph (those to a 3D part, see `IS_ONLY_RELATIONS_TO_3D_PARTS`); none for a part it does not have. */
export function relationsOf(node: ShipTreeNode): OntologyRelation[] {
  return partRelationsOf(node.label)
    .filter((relation) => !IS_ONLY_RELATIONS_TO_3D_PARTS || relation.partLabel)
    .map((relation) => ({
    ...relation,
    sectionId: relation.partLabel ? getSectionIdOf({ id: relation.partLabel, label: relation.partLabel }) : undefined,
  }));
}
