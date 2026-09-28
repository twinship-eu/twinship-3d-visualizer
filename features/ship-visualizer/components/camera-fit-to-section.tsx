
import { ShipTreeNode } from "../ship-visualizer-types";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Group, Mesh, Vector3 } from "three/webgpu";
import { CAMERA_TRANSITION_DURATION_S, DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "../ship-visualizer-config";
import { easeOutCubic, getMatchingMeshUuids } from "../lib/3d-model";
import { CAMERA_FIT_PADDING, MIN_CAMERA_DISTANCE } from "../lib/constants";
import { SEASCAPE_SURFACE_LEVEL_Y } from "@/features/3d-scene/lib/seascape-config";

/** How far above the part the camera looks down from, in radians (30°), for a part above the water. */
const CAMERA_FIT_ELEVATION = Math.PI / 6;

export default function CameraFitToSelection({
  root,
  selectedNode,
}: {
  root: Group;
  selectedNode: ShipTreeNode | null;
}) {
  const { camera, controls } = useThree();
  const fitPending = useRef(false);
  const resetPending = useRef(false);
  const animating = useRef(false);
  const progress = useRef(0);
  const startPosition = useRef(new Vector3());
  const endPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const endTarget = useRef(new Vector3());

  // Swapping the model remounts this component. Resetting on that first run
  // would throw away the camera the user had framed, which makes comparing two
  // builds of the same model impossible, so only react to later changes.
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (selectedNode) {
      fitPending.current = true;
    } else {
      resetPending.current = true;
    }
  }, [selectedNode]);

  useFrame((_, delta) => {
    const ctrl = controls as { target?: Vector3 };
    const targetObj = ctrl?.target;

    if (resetPending.current && targetObj) {
      startPosition.current.copy(camera.position);
      startTarget.current.copy(targetObj);
      endPosition.current.set(
        DEFAULT_CAMERA_POSITION[0],
        DEFAULT_CAMERA_POSITION[1],
        DEFAULT_CAMERA_POSITION[2]
      );
      endTarget.current.set(
        DEFAULT_CAMERA_TARGET[0],
        DEFAULT_CAMERA_TARGET[1],
        DEFAULT_CAMERA_TARGET[2]
      );
      progress.current = 0;
      animating.current = true;
      resetPending.current = false;
    }

    if (fitPending.current && selectedNode && targetObj) {
      root.updateMatrixWorld(true);
      const matchingUuids = getMatchingMeshUuids(root, selectedNode);
      const box = new Box3();
      let hasMatch = false;
      root.traverse((child) => {
        if ((child as Mesh).isMesh && matchingUuids.has(String((child as Mesh).uuid))) {
          const mesh = child as Mesh;
          if (mesh.geometry?.boundingBox) {
            mesh.geometry.computeBoundingBox();
            const meshBox = mesh.geometry.boundingBox!.clone();
            meshBox.applyMatrix4(mesh.matrixWorld);
            box.union(meshBox);
            hasMatch = true;
          } else {
            box.expandByObject(mesh);
            hasMatch = true;
          }
        }
      });
      if (hasMatch && !box.isEmpty()) {
        const partCenter = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const fov = (camera as { fov?: number }).fov ?? 45;
        const distance = (CAMERA_FIT_PADDING * maxDim) / (2 * Math.tan((fov * Math.PI) / 360));
        const dist = Math.max(distance, MIN_CAMERA_DISTANCE);
        const shipBox = new Box3().setFromObject(root);
        const shipCenter = shipBox.getCenter(new Vector3());
        // Out from the ship towards the part, across the water: then from a
        // little above for a part above the water, or level with it, under the
        // water, for a part wholly below it. (Straight out from the ship's
        // centre, low parts like the engine sent the camera into the waves.)
        const across = partCenter.clone().sub(shipCenter).setY(0);
        if (across.lengthSq() < 1e-6) across.set(1, 0, 1);
        across.normalize();
        const isUnderWater = box.max.y < SEASCAPE_SURFACE_LEVEL_Y;
        const elevation = isUnderWater ? 0 : CAMERA_FIT_ELEVATION;
        const toCamera = across.multiplyScalar(Math.cos(elevation)).setY(Math.sin(elevation));
        startPosition.current.copy(camera.position);
        startTarget.current.copy(targetObj);
        endTarget.current.copy(partCenter);
        endPosition.current.copy(partCenter).add(toCamera.multiplyScalar(dist));
        progress.current = 0;
        animating.current = true;
      }
      fitPending.current = false;
    }

    if (animating.current && targetObj) {
      progress.current += delta / CAMERA_TRANSITION_DURATION_S;
      const t = Math.min(1, progress.current);
      const eased = easeOutCubic(t);
      camera.position.lerpVectors(startPosition.current, endPosition.current, eased);
      targetObj.lerpVectors(startTarget.current, endTarget.current, eased);
      if (t >= 1) animating.current = false;
    }
  });

  return null;
}