import { DEFAULT_SECTION_DOT_CLASS, SECTION_DOT_CLASSES } from "../ship-visualizer-config";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { getSectionIdForNode } from "./map-tree-to-sections";

/** The section a node belongs to: itself, if it is one; the ship model, for a model. */
export function getSectionIdOf(node: ShipTreeNode): string {
  if (node.id in SECTION_DOT_CLASSES) return node.id;
  if (node.modelPath) return "ship-model";
  return getSectionIdForNode(node);
}

/** The Tailwind class for the dot in a section's colour. */
export function getSectionDotClass(sectionId: string): string {
  return SECTION_DOT_CLASSES[sectionId] ?? DEFAULT_SECTION_DOT_CLASS;
}
