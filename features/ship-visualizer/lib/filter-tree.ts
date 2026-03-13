import type { ShipTreeNode } from "../ship-visualizer-types";

/**
 * Returns nodes that match the query (label, case-insensitive) or have a matching descendant.
 * Preserves tree structure: parent is included if any descendant matches.
 */
export function filterShipTree(nodes: ShipTreeNode[], query: string): ShipTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function matches(node: ShipTreeNode): boolean {
    return node.label.toLowerCase().includes(q);
  }

  function filterNode(node: ShipTreeNode): ShipTreeNode | null {
    const children = node.children?.map(filterNode).filter((n): n is ShipTreeNode => n !== null);
    const hasMatchingChild = children && children.length > 0;
    if (matches(node) || hasMatchingChild) {
      return { ...node, children: children?.length ? children : undefined };
    }
    return null;
  }

  return nodes.map(filterNode).filter((n): n is ShipTreeNode => n !== null);
}


export function collectNodeIds(node: ShipTreeNode): string[] {
  const ids = [node.id];
  for (const child of node.children ?? []) {
    ids.push(...collectNodeIds(child));
  }
  return ids;
}
