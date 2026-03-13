import type { ShipTreeNode } from "../ship-visualizer-types";
import {
  NON_SELECTABLE_SECTION_IDS,
  SHIP_TREE_SECTIONS,
} from "../ship-visualizer-config";

type SectionId = (typeof SHIP_TREE_SECTIONS)[number]["id"];

function getSectionIdForLabel(label: string): SectionId {
  const lower = label.toLowerCase();
  if (lower.includes("propeller")) return "propeller";
  if (lower === "engine" || lower.startsWith("engine")) return "energy";
  if (
    lower.includes("windturbine") ||
    lower.includes("wind turbine") ||
    lower.includes("wind tower")
  ) {
    return "windAssisted";
  }
  if (lower.includes("crane") || lower.includes("container")) return "deck";
  if (lower.includes("solar")) return "hull";
  if (lower.includes("decal")) return "hull";
  if (lower.startsWith("base")) return "hull";
  if (lower.includes("balcony")) return "superstructure";
  return "hull";
}

export function getSectionIdForNode(node: ShipTreeNode): SectionId {
  return getSectionIdForLabel(node.label);
}

export function isNodeInNonSelectableSection(node: ShipTreeNode): boolean {
  const sectionId = getSectionIdForNode(node);
  return NON_SELECTABLE_SECTION_IDS.includes(sectionId);
}

export function mapModelTreeToSections(flatNodes: ShipTreeNode[]): ShipTreeNode[] {
  const bySection = new Map<SectionId, ShipTreeNode[]>();

  for (const section of SHIP_TREE_SECTIONS) {
    bySection.set(section.id, []);
  }

  for (const node of flatNodes) {
    const sectionId = getSectionIdForLabel(node.label);
    const list = bySection.get(sectionId);
    if (list) list.push(node);
  }

  return SHIP_TREE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    children: bySection.get(section.id) ?? [],
  }));
}
