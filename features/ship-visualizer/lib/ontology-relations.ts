import { getObjectDetailsForNode } from "../selection-details";
import { SHIP_TREE_SECTIONS } from "../ship-visualizer-config";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { getSectionIdOf } from "./section-colors";

/** A connection with no relation of its own named in the ontology. */
const DEFAULT_RELATION = "connectedTo";

/** A relation in the ontology: its name, the other end's label, and that end's section. */
export type OntologyRelation = { relation: string; label: string; sectionId: string };

/** A component's relations: the section it is part of, then its connections. */
export function relationsOf(node: ShipTreeNode): OntologyRelation[] {
  const sectionId = getSectionIdOf(node);
  const section = SHIP_TREE_SECTIONS.find((candidate) => candidate.id === sectionId);
  // A section is part of nothing: only its components are
  const partOf: OntologyRelation[] =
    section && section.id !== node.id ? [{ relation: "partOf", label: section.label, sectionId: section.id }] : [];
  const connections = getObjectDetailsForNode(node).connectedComponents.map((component) => ({
    relation: component.relation ?? DEFAULT_RELATION,
    label: component.label,
    sectionId: getSectionIdOf({ id: component.id, label: component.label }),
  }));

  return [...partOf, ...connections];
}
