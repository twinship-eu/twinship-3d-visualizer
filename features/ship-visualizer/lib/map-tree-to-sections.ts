import type { ShipTreeNode } from "../ship-visualizer-types";
import { SHIP_TREE_SECTIONS } from "../ship-visualizer-config";

type SectionId = (typeof SHIP_TREE_SECTIONS)[number]["id"];


function getSectionIdForLabel(label: string): SectionId {
  const lower = label.toLowerCase();
  if (lower === "engine" || lower.startsWith("engine")) return "propulsion";
  if (lower.includes("solar")) return "hull";
  if (lower.includes("decal")) return "hull";
  if (lower.startsWith("base")) return "hull";
  if (lower.includes("balcony")) return "superstructure";
  if (lower.includes("container")) return "deck";
  return "hull";
}

export function mapModelTreeToSections(flatNodes: ShipTreeNode[]): ShipTreeNode[] {
  const bySection = new Map<SectionId, ShipTreeNode[]>();

  for (const section of SHIP_TREE_SECTIONS) {
    bySection.set(section.id, []);
  }

  for (const node of flatNodes) {
    if (node.label === "Engine") continue;
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
