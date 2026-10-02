import graph from "../data/futuristic-vessel-kg.json";
import { ONTOLOGY_PAGE_URL, PART_INSTANCES, QUALIFYING_TYPES, RELATION_ORDER } from "../ship-knowledge-graph-config";

/** A class or a property of the ontology: its IRI, label and definition. */
type OntologyTerm = { iri: string; label: string | null; comment: string | null };

/** An instance of the knowledge graph: its label, its classes, its values by property. */
export type KnowledgeGraphInstance = {
  label: string;
  types: string[];
  values: Record<string, string | number | boolean>;
};

type KnowledgeGraph = {
  source: { pipeline: string; commit: string | null; workbook: string; exportedAt: string; unknownValue: number };
  instances: Record<string, KnowledgeGraphInstance>;
  relations: { subject: string; predicate: string; object: string }[];
  classes: Record<string, OntologyTerm>;
  properties: Record<string, OntologyTerm>;
};

export const KNOWLEDGE_GRAPH = graph as KnowledgeGraph;

const PART_OF_INSTANCE = new Map(
  Object.entries(PART_INSTANCES).flatMap(([part, ids]) => ids.map((id) => [id, part] as const))
);

/** The knowledge graph's instances a 3D part shows; none for a part not in the graph. */
export function instancesOfPart(partLabel: string): string[] {
  return PART_INSTANCES[partLabel] ?? [];
}

/** The 3D part showing an instance, when the model has one. */
export function partOfInstance(instanceId: string): string | undefined {
  return PART_OF_INSTANCE.get(instanceId);
}

/** What an instance is: its class, passing over the types that only qualify it (AC, four-stroke…). */
export function classOf(instanceId: string): string {
  const types = KNOWLEDGE_GRAPH.instances[instanceId]?.types ?? [];
  const kinds = types.filter((type) => !QUALIFYING_TYPES.has(type));
  return kinds.find((type) => type.endsWith("System")) ?? kinds[0] ?? types[0] ?? "Thing";
}

export function classLabel(className: string): string {
  return KNOWLEDGE_GRAPH.classes[className]?.label ?? className;
}

/** A class's or property's page in the ontology's documentation. */
export function ontologyPageOf(term: OntologyTerm | undefined): string | undefined {
  return term ? `${ONTOLOGY_PAGE_URL}${term.iri}` : undefined;
}

/**
 * A relation of a part, as the design shows it: the ontology's predicate, and
 * the other end — a 3D part to jump to, or an instance the model has no part
 * for, named by its class. Instances alike are one relation: the two SCRs.
 */
export type PartRelation = {
  relation: (typeof RELATION_ORDER)[number];
  /** The predicate in full, as in the graph: ido:connectedTo. */
  predicate: string;
  /** The other end's 3D part, by its label; absent when the model has none. */
  partLabel?: string;
  /** What the other end is called: the part's label, or its class's. */
  label: string;
  /** The knowledge graph's instances at the other end. */
  instanceIds: string[];
  /** Reached through nodes the model has no 3D part for, not directly: shown as a connection all the same. */
  isIndirect?: boolean;
};

const RELATION_NAMES: Record<string, (typeof RELATION_ORDER)[number]> = {
  "ido:partOf": "partOf",
  "ido:directlyConnectedTo": "directlyConnectedTo",
  "ido:connectedTo": "connectedTo",
  "tws:consume": "consume",
};

/** The connections as a graph both ways, built once: instance to the instances it is connected to. */
const CONNECTION_PREDICATES = new Set(["ido:directlyConnectedTo", "ido:connectedTo", "tws:consume"]);
/** How many steps a connection may take through instances without a 3D part. */
const MAX_INDIRECT_STEPS = 4;
let connectionGraph: Map<string, Set<string>> | null = null;

function connectionsOf(instanceId: string) {
  if (!connectionGraph) {
    connectionGraph = new Map();
    for (const { subject, predicate, object } of KNOWLEDGE_GRAPH.relations) {
      if (!CONNECTION_PREDICATES.has(predicate)) continue;
      if (!connectionGraph.has(subject)) connectionGraph.set(subject, new Set());
      if (!connectionGraph.has(object)) connectionGraph.set(object, new Set());
      connectionGraph.get(subject)?.add(object);
      connectionGraph.get(object)?.add(subject);
    }
  }
  return connectionGraph.get(instanceId) ?? new Set<string>();
}

/**
 * The other 3D parts a part is connected to, through instances the model has
 * no part for, nearest first: part label to the instance reached.
 */
function indirectPartsFrom(own: Set<string>, partLabel: string) {
  const reached = new Map<string, string>();
  const seen = new Set(own);
  let frontier = [...own];
  for (let step = 0; step < MAX_INDIRECT_STEPS && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const instanceId of frontier) {
      for (const other of connectionsOf(instanceId)) {
        if (seen.has(other)) continue;
        seen.add(other);
        const otherPart = partOfInstance(other);
        // A 3D part ends the path; the vessel itself is no intermediary
        if (otherPart) {
          if (otherPart !== partLabel && !reached.has(otherPart)) reached.set(otherPart, other);
        } else {
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return reached;
}

/**
 * A part's relations in the knowledge graph: from its instances to others,
 * and what is part of them (`hasPart`). Parts first, then the rest, each in
 * RELATION_ORDER. Empty for a part the graph does not have.
 */
export function partRelationsOf(partLabel: string): PartRelation[] {
  const own = new Set(instancesOfPart(partLabel));
  if (own.size === 0) return [];

  const grouped = new Map<string, PartRelation>();
  const add = (relation: PartRelation["relation"], predicate: string, other: string) => {
    if (own.has(other)) return;
    const partLabelOfOther = partOfInstance(other);
    const key = `${relation}|${partLabelOfOther ?? classOf(other)}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.instanceIds.includes(other)) existing.instanceIds.push(other);
      return;
    }
    grouped.set(key, {
      relation,
      predicate,
      partLabel: partLabelOfOther,
      label: partLabelOfOther ?? classLabel(classOf(other)),
      instanceIds: [other],
    });
  };

  for (const { subject, predicate, object } of KNOWLEDGE_GRAPH.relations) {
    const relation = RELATION_NAMES[predicate];
    if (!relation) continue;
    if (own.has(subject)) add(relation, predicate, object);
    else if (own.has(object) && relation === "partOf") add("hasPart", "ido:hasPart", subject);
  }

  // A connection through an intermediary the model does not show is still a
  // connection of the part: the Engine to the Propellers through a switchboard
  // that is no part of the 3D model. Only through connections (not the vessel
  // they are all part of), up to a few steps
  const shownParts = new Set([...grouped.values()].flatMap((relation) => (relation.partLabel ? [relation.partLabel] : [])));
  for (const [partLabelOfOther, instanceId] of indirectPartsFrom(own, partLabel)) {
    if (shownParts.has(partLabelOfOther)) continue;
    grouped.set(`connectedTo|${partLabelOfOther}`, {
      relation: "connectedTo",
      predicate: "ido:connectedTo",
      partLabel: partLabelOfOther,
      label: partLabelOfOther,
      instanceIds: [instanceId],
      isIndirect: true,
    });
  }

  const rank = (relation: PartRelation) =>
    (relation.partLabel ? 0 : RELATION_ORDER.length) + RELATION_ORDER.indexOf(relation.relation);
  return [...grouped.values()].sort((first, second) => rank(first) - rank(second));
}

/** A value as the card shows it: the graph's -1 is "unknown", shown as nothing. */
function displayValue(value: string | number | boolean | undefined) {
  if (value === undefined || value === KNOWLEDGE_GRAPH.source.unknownValue || value === String(KNOWLEDGE_GRAPH.source.unknownValue)) {
    return "";
  }
  return typeof value === "number" ? String(Number.isInteger(value) ? value : Number(value.toFixed(3))) : String(value);
}

/**
 * A part's parameters, from its instances' values: one row a property, its
 * values joined when they differ — those the graph knows first.
 */
export function partParametersOf(partLabel: string) {
  const instances = instancesOfPart(partLabel).map((id) => KNOWLEDGE_GRAPH.instances[id]).filter(Boolean);
  const names = [...new Set(instances.flatMap((instance) => Object.keys(instance.values)))].sort();
  const parameters = names.map((property) => {
    const shown = [...new Set(instances.map((instance) => displayValue(instance.values[property])))];
    const term = KNOWLEDGE_GRAPH.properties[property];
    return {
      property,
      name: term?.label ?? property,
      value: shown.every((value) => value === "") ? "" : shown.map((value) => value || "unknown").join(" / "),
      href: ontologyPageOf(term),
    };
  });
  return [...parameters.filter((parameter) => parameter.value), ...parameters.filter((parameter) => !parameter.value)];
}
