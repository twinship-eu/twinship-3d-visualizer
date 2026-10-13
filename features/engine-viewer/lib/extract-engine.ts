import { Box3, Group, Sphere, Vector3, type Object3D } from "three/webgpu";

export type ExtractedEngine = {
  /** The engine, recentred on the origin, so orbit controls turn it about its middle. */
  root: Group;
  /** Radius of the sphere that encloses it; the camera is framed from this. */
  radius: number;
};

/** Thrown when the model has no node with the expected name. */
export class EngineNodeNotFoundError extends Error {
  constructor(nodeName: string) {
    super(`The model has no "${nodeName}" node to show`);
    this.name = "EngineNodeNotFoundError";
  }
}

/**
 * Copies the named node out of the loaded ship and centres it on the origin.
 *
 * The clone is detached from the ship, so its transform is its own and the
 * ship's position, scale and waterline do not carry over. Geometry and
 * materials are shared with the original, so nothing is duplicated on the GPU.
 */
export function extractEngine(scene: Object3D, nodeName: string): ExtractedEngine {
  const node = scene.getObjectByName(nodeName);
  if (!node) throw new EngineNodeNotFoundError(nodeName);

  const engine = node.clone();
  engine.updateMatrixWorld(true);

  const bounds = new Box3().setFromObject(engine);
  const center = bounds.getCenter(new Vector3());
  const radius = bounds.getBoundingSphere(new Sphere()).radius;

  const root = new Group();
  root.add(engine);
  engine.position.sub(center);

  return { root, radius };
}
