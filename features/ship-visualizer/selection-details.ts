import type { ShipTreeNode } from "./ship-visualizer-types";
import type { ObjectDetails } from "./components/selection-details-modal-types";
import {
  classLabel,
  classOf,
  instancesOfPart,
  KNOWLEDGE_GRAPH,
  ontologyPageOf,
  partParametersOf,
} from "./lib/knowledge-graph";
import { getSectionIdOf } from "./lib/section-colors";
import { SHIP_TREE_SECTIONS } from "./ship-visualizer-config";

const DEFAULT_DETAILS: ObjectDetails = {
  description: "Details for this component will be available in a future version.",
  parameters: [],
};

/**
 * The parts the knowledge graph does not have yet, as written from the
 * vessel's specification: the hull's general particulars, the control room…
 * The parts it has (see `PART_INSTANCES`) are described from it instead.
 */
const OBJECT_DETAILS_BY_LABEL: Record<string, ObjectDetails> = {
  "Base Hull": {
    title: "Base Hull",
    tags: ["Hull"],
    description:
      "The main hull structure providing buoyancy and distributing loads across the vessel. General specifications of the futuristic RoRo vessel.",
    parameters: [
      { name: "Ship type", value: "RoRo" },
      { name: "Length over all", value: "abt. 200 m" },
      { name: "Breadth moulded", value: "abt. 31 m" },
      { name: "DWT", value: "17000 DWT" },
      { name: "Payload", value: "Abt. 11000 tons" },
      { name: "Cargo lane meter", value: "Abt. 4000 lm" },
      { name: "Design draught", value: "abt. 7.0 m" },
      { name: "Design speed", value: "abt. 18 kn" },
      { name: "Unmanned vessel", value: "Yes" },
      { name: "Route profile", value: "Northern Europe" },
      { name: "Engine and power", value: "Dual fuel Battery Hybrid" },
      { name: "Fuel type(s)", value: "Bio-fuel (B100) and Ammonia (Green)" },
      { name: "Engine types", value: "Wartsila 10V31 DF" },
      { name: "Battery bank", value: "Estm. 7 MWhr for low load operation and power back-up" },
      { name: "Propeller", value: "CPP, Two propeller, 4-bladed, diameter 4,8 meter" },
      { name: "Rudder", value: "2 pair of gate rudders" },
      { name: "Stern & Bow thrusters", value: "BOW 2 x 1800 kW" },
      { name: "Endurance", value: "Two (2) Type C tanks each abt. 360 m³, range abt. 1600 nm" },
      { name: "Electrical power system", value: "AC and DC low loss design" },
      { name: "Shore power", value: "For recharge battery and zero emission in port" },
    ],
  },
  "Hull top towers": {
    title: "Hull top towers",
    tags: ["Hull"],
    description:
      "Upper hull tower structures used for supporting equipment and providing visibility. Part of the RoRo vessel.",
    parameters: [],
  },
  "Control room": {
    title: "Control room",
    tags: ["Hull"],
    description:
      "The main operational control space housing navigation, monitoring, and communication systems.",
    parameters: [],
  },
  Radio: {
    title: "Radio",
    tags: ["Hull"],
    description:
      "Radio and antenna systems used for ship-to-ship and ship-to-shore communication.",
    parameters: [],
  },
  "Truck with trailer": {
    title: "Truck with trailer",
    tags: ["Cargo"],
    description: "A refrigerated truck with trailer carried on the RoRo deck: cargo, its reefer unit monitored.",
    parameters: [],
  },
  Crane: {
    title: "Crane",
    tags: ["Cargo"],
    description: "Deck crane used for handling cargo and equipment on board.",
    parameters: [],
  },
};

/**
 * A part the knowledge graph has, as it says: its instances' class — linked
 * to the ontology — and its definition, and their values.
 */
function knowledgeGraphDetails(node: ShipTreeNode): ObjectDetails {
  const instanceIds = instancesOfPart(node.label);
  const className = classOf(instanceIds[0]);
  const term = KNOWLEDGE_GRAPH.classes[className];
  const section = SHIP_TREE_SECTIONS.find((candidate) => candidate.id === getSectionIdOf(node));
  const kinds = [...new Set(instanceIds.flatMap((id) => KNOWLEDGE_GRAPH.instances[id]?.types ?? []))]
    .filter((type) => type !== className)
    .map(classLabel);

  return {
    title: node.label,
    titleHref: ontologyPageOf(term),
    // The section, and the class unless it is the section by another spelling
    tags: [
      ...(section ? [section.label] : []),
      ...(section?.label.toLowerCase() === classLabel(className).toLowerCase() ? [] : [classLabel(className)]),
    ],
    description: [
      term?.comment ?? classLabel(className),
      `In the knowledge graph: ${instanceIds.join(", ")}${kinds.length ? ` — ${kinds.join(", ")}` : ""}.`,
    ].join(" "),
    parameters: partParametersOf(node.label),
  };
}

export function getObjectDetailsForNode(node: ShipTreeNode): ObjectDetails {
  if (instancesOfPart(node.label).length > 0) return knowledgeGraphDetails(node);
  return OBJECT_DETAILS_BY_LABEL[node.label] ?? DEFAULT_DETAILS;
}
