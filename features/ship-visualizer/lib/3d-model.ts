import {
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  Object3D,
  SRGBColorSpace,
  Texture,
} from "three";
import { ShipTreeNode } from "../ship-visualizer-types";

/**
 * Traverses the scene and sets material.side = DoubleSide on every mesh.
 * Does not set transparent: true — that causes depth-sorting artifacts (hull
 * appearing see-through from some angles). Transparency is enabled only when
 * needed in applySelectionOpacity.
 */
export function setMaterialsDoubleSide(root: Object3D): void {
  root.traverse((child) => {
    if ("material" in child && (child as Mesh).material) {
      const mesh = child as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m: Material) => {
        (m as Material & { side?: number }).side = DoubleSide;
      });
    }
  });
}

/**
 * Gives each mesh its own material clone and captures base opacity state.
 * Required so selection/hover can set opacity per mesh without affecting
 * other meshes that shared the same material.
 */
export function ensureUniqueMaterialsPerMesh(root: Object3D): void {
  root.traverse((child) => {
    if (!("material" in child) || !(child as Mesh).material) return;
    const mesh = child as Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = materials.map((m: Material) => {
      const clone = m.clone();
      const mat = clone as Material & {
        userData: { __baseState?: { opacity: number; transparent: boolean; depthWrite: boolean } };
      };
      mat.userData ??= {};
      mat.userData.__baseState = {
        opacity: typeof m.opacity === "number" ? m.opacity : 1,
        transparent: Boolean(m.transparent),
        depthWrite: m.depthWrite !== undefined ? m.depthWrite : true,
      };
      return clone;
    });
    mesh.material = cloned.length === 1 ? cloned[0] : cloned;
  });
}

/**
 * Copies texture references (map, normalMap, etc.) from source to clone by traversing
 * both in parallel. Use after cloning to preserve textures that may be lost on clone.
 */
export function copyMaterialMapsFrom(source: Object3D, clone: Object3D): void {
  if ((source as Mesh).isMesh && (clone as Mesh).isMesh) {
    const srcMesh = source as Mesh;
    const clnMesh = clone as Mesh;
    const srcMats = Array.isArray(srcMesh.material) ? srcMesh.material : [srcMesh.material];
    const clnMats = Array.isArray(clnMesh.material) ? clnMesh.material : [clnMesh.material];
    for (let i = 0; i < Math.min(srcMats.length, clnMats.length); i++) {
      const sm = srcMats[i] as Material & Record<string, Texture | null | undefined>;
      const cm = clnMats[i] as Material & Record<string, Texture | null | undefined>;
      if (sm.map) cm.map = sm.map;
      if (sm.normalMap) cm.normalMap = sm.normalMap;
      if (sm.roughnessMap) cm.roughnessMap = sm.roughnessMap;
      if (sm.metalnessMap) cm.metalnessMap = sm.metalnessMap;
      if (sm.aoMap) cm.aoMap = sm.aoMap;
    }
  }
  const srcChildren = source.children;
  const clnChildren = clone.children;
  for (let i = 0; i < Math.min(srcChildren.length, clnChildren.length); i++) {
    copyMaterialMapsFrom(srcChildren[i], clnChildren[i]);
  }
}

export function applyShipMaterial(
  clone: Group,
  shipColor: Color,
  texture?: Texture | null
) {
  if (texture) {
    texture.colorSpace = SRGBColorSpace;
  }
  clone.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
    if ("material" in child && (child as Mesh).material) {
      const mesh = child as Mesh;
      const mat = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
      const applyMaterial = (m: Material) => {
        if ("color" in m && m.color instanceof Color) m.color.copy(shipColor);
        if (texture && "map" in m) {
          (m as Material & { map: Texture | null }).map = texture;
        }
        (m as Material & { side?: number }).side = DoubleSide;
      };
      if (Array.isArray(mat)) {
        mat.forEach(applyMaterial);
        mesh.material = mat;
      } else {
        applyMaterial(mat);
        mesh.material = mat;
      }
    }
  });
}

type MaterialBaseState = {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

function getOrInitMaterialBaseState(m: Material): MaterialBaseState {
  const anyMat = m as Material & {
    userData: { __baseState?: MaterialBaseState } & Record<string, unknown>;
    opacity?: number;
    transparent?: boolean;
    depthWrite?: boolean;
  };
  if (!anyMat.userData.__baseState) {
    anyMat.userData.__baseState = {
      opacity: typeof anyMat.opacity === "number" ? anyMat.opacity : 1,
      transparent: Boolean(anyMat.transparent),
      depthWrite: anyMat.depthWrite !== undefined ? anyMat.depthWrite : true,
    };
  }
  return anyMat.userData.__baseState;
}

export function getObjectByUuid(root: Object3D, uuid: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((obj) => {
    if (String(obj.uuid) === uuid) found = obj;
  });
  return found;
}

export function collectMeshUuids(obj: Object3D, set: Set<string>): void {
  obj.traverse((o) => {
    if ((o as Mesh).isMesh) set.add(String(o.uuid));
  });
}

/** Returns the set of mesh uuids that belong to the given node (the node's object and its descendants only). */
export function getMatchingMeshUuids(root: Group, node: ShipTreeNode): Set<string> {
  const set = new Set<string>();
  if (node.objectUuid !== undefined) {
    const obj = getObjectByUuid(root, node.objectUuid);
    if (obj) {
      collectMeshUuids(obj, set);
      if (set.size > 0) return set;
    }
  }
  root.traverse((o) => {
    if ((o as Mesh).isMesh && meshMatchesNodeByName(o as Mesh, node)) {
      set.add(String(o.uuid));
    }
  });
  return set;
}

export function meshMatchesNodeByName(mesh: { name: string }, node: ShipTreeNode): boolean {
  const nameLower = mesh.name.toLowerCase().trim();
  if (!nameLower) return false;
  const labelLower = node.label.toLowerCase().trim();
  if (labelLower && nameLower.includes(labelLower)) return true;
  const idParts = node.id.split("-");
  return idParts.some((part) => part.length > 1 && nameLower.includes(part.toLowerCase()));
}

export function buildNode(obj: Object3D): ShipTreeNode {
  const children = obj.children.length > 0 ? obj.children.map((c) => buildNode(c)) : undefined;
  const uuid = String(obj.uuid);
  return {
    id: uuid,
    label: (obj.name && obj.name.trim()) || "Unnamed",
    objectUuid: uuid,
    children,
  };
}

export function buildTreeFromModel(root: Group): ShipTreeNode[] {
  return root.children.map((child) => buildNode(child));
}

export function applySelectionOpacity(
  root: Group,
  selectedNode: ShipTreeNode | null,
  hoveredNode: ShipTreeNode | null,
  unselectedOpacity: number
) {
  if (selectedNode === null && hoveredNode === null) {
    root.traverse((child) => {
      if ("material" in child && (child as Mesh).material) {
        const mesh = child as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m: Material) => {
          const base = getOrInitMaterialBaseState(m);
          (m as Material & { opacity: number }).opacity = base.opacity;
          (m as Material & { transparent: boolean }).transparent = base.transparent;
          (m as Material & { depthWrite: boolean }).depthWrite = base.depthWrite;
          (m as Material & { needsUpdate?: boolean }).needsUpdate = true;
        });
      }
    });
    return;
  }

  const selectedUuids =
    selectedNode !== null ? getMatchingMeshUuids(root, selectedNode) : new Set<string>();
  const hoveredUuids =
    hoveredNode !== null ? getMatchingMeshUuids(root, hoveredNode) : new Set<string>();
  const hasSelection = selectedUuids.size > 0;
  const hasHover = hoveredUuids.size > 0;
  if (!hasSelection && !hasHover) return;

  root.traverse((child) => {
    if ("material" in child && (child as Mesh).material) {
      const mesh = child as Mesh;
      const meshId = String(mesh.uuid);
      const isSelected = selectedUuids.has(meshId);
      const isHovered = hoveredUuids.has(meshId);

      const opacity: number =
        isSelected && isHovered
          ? unselectedOpacity
          : isSelected || isHovered
            ? 1
            : unselectedOpacity;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m: Material) => {
        const base = getOrInitMaterialBaseState(m);
        const isDimmed = opacity < 1;
        const targetOpacity = isDimmed ? base.opacity * opacity : base.opacity;
        const targetTransparent = isDimmed ? true : base.transparent;
        const targetDepthWrite = isDimmed ? false : base.depthWrite;

        (m as Material & { opacity: number }).opacity = targetOpacity;
        (m as Material & { transparent: boolean }).transparent = targetTransparent;
        (m as Material & { depthWrite: boolean }).depthWrite = targetDepthWrite;
        (m as Material & { needsUpdate?: boolean }).needsUpdate = true;
      });
    }
  });
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function findNodeByHitObject(nodes: ShipTreeNode[], hitObject: Object3D): ShipTreeNode | null {
  const uuidSet = new Set<string>();
  let obj: Object3D | null = hitObject;
  while (obj) {
    uuidSet.add(String(obj.uuid));
    obj = obj.parent;
  }
  function search(nodelist: ShipTreeNode[]): ShipTreeNode | null {
    for (const node of nodelist) {
      if (node.modelPath) continue;
      if (node.objectUuid !== undefined && uuidSet.has(node.objectUuid)) return node;
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(nodes);
}
