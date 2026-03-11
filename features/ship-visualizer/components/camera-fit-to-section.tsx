
import { ShipTreeNode } from "../ship-visualizer-types";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Group, Mesh, Vector3 } from "three";
import { CAMERA_TRANSITION_DURATION_S, DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "../ship-visualizer-config";
import { easeOutCubic, getMatchingMeshUuids } from "../lib/3d-model";
import { CAMERA_FIT_PADDING, MIN_CAMERA_DISTANCE } from "../lib/constants";

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

  useEffect(() => {
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
        const toCamera = partCenter.clone().sub(shipCenter);
        if (toCamera.lengthSq() < 1e-6) {
          toCamera.set(1, 1, 1).normalize();
        } else {
          toCamera.normalize();
        }
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