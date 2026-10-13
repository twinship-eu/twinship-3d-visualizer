import { Mesh, MeshStandardMaterial, type Object3D } from "three/webgpu";

/**
 * Scales the metalness of every standard material under `root`.
 *
 * For devices that skip the sky probe: without anything to reflect, a fully
 * metallic surface has no diffuse response and renders black under any light.
 * Easing it back lets the fill lights reach the paint. A scale, so parts the
 * model authored as dielectric stay at 0.
 *
 * Mutates the materials in place, so the caller must own them, not share them
 * with the cached ship model (see `ensureUniqueMaterialsPerMesh`).
 */
export function scaleEngineMetalness(root: Object3D, scale: number): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) material.metalness *= scale;
    }
  });
}
