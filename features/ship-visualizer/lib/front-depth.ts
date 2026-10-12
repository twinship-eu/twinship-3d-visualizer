import { cameraFar, cameraNear, positionView, viewZToPerspectiveDepth } from "three/tsl";
import type { Group, Material, Mesh } from "three/webgpu";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { getMatchingMeshUuids } from "./3d-model";

/**
 * The parts drawn in front of the whole ship when selected: those hidden
 * inside or under it, which the ghosted hull and the sea would otherwise
 * cover. The deck's parts stay as they are, grounded on the ship.
 */
const FRONT_DEPTH_PART_LABELS = new Set(["Engine", "Propellers"]);
/**
 * The share of the depth range the selected part is squeezed into, at its
 * front: everything else lies behind it, its own surfaces still in order.
 */
const FRONT_DEPTH_SHARE = 0.01;

/** The meshes given front-depth materials, and the materials they had; and the part they are, by its node id. */
const lifted = new Map<Mesh, Material | Material[]>();
let liftedNodeId: string | null = null;

/** The part drawn in front now, by its node id: null for none. */
export function frontDepthNodeId() {
  return liftedNodeId;
}

/** A copy of a material whose depth is the scene's, squeezed to the front of the range. */
function frontDepthCopy(material: Material) {
  const copy = material.clone() as Material & { depthNode: unknown };
  copy.depthNode = viewZToPerspectiveDepth(positionView.z, cameraNear, cameraFar).mul(FRONT_DEPTH_SHARE);
  return copy;
}

/** Puts back the materials the lifted meshes had, and frees their copies. */
export function restoreFrontDepth() {
  for (const [mesh, original] of lifted) {
    const copies = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    copies.forEach((copy) => copy.dispose());
    mesh.material = original;
  }
  lifted.clear();
  liftedNodeId = null;
}

/**
 * Draws the selected part, if it is one of the hidden ones, in front of
 * everything — the ghosted hull, the deck, the sea — while it keeps its own
 * depth order: copies of its materials with a depth squeezed to the front of
 * the range, so nothing else passes the depth test where it is. Copies, so
 * a material shared with another part is left alone. `restoreFrontDepth`
 * undoes it. The same part again changes nothing: its copies are kept.
 */
export function applyFrontDepth(root: Group, selectedNode: ShipTreeNode | null) {
  if (selectedNode !== null && selectedNode.id === liftedNodeId) return;
  restoreFrontDepth();
  if (!selectedNode || !FRONT_DEPTH_PART_LABELS.has(selectedNode.label)) return;
  liftedNodeId = selectedNode.id;
  const meshIds = getMatchingMeshUuids(root, selectedNode);
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !meshIds.has(String(mesh.uuid)) || mesh.userData.isAlarmGlow) return;
    lifted.set(mesh, mesh.material);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(frontDepthCopy) : frontDepthCopy(mesh.material);
  });
}
