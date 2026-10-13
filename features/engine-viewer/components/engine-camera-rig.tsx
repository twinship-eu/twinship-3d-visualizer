"use client";

import { useLayoutEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three/webgpu";
import { ENGINE_CAMERA } from "../engine-viewer-config";

type Props = {
  /** Radius of the sphere enclosing the engine, whose centre sits at the origin. */
  radius: number;
};

/**
 * How much further back to start on a portrait screen. The camera's field of view
 * is vertical, so on a screen taller than wide the horizontal view is narrower
 * and the engine would overflow the sides; backing off by the inverse aspect
 * gives it the same width on screen that it has height on a landscape one.
 */
function portraitDistanceScale(aspect: number): number {
  return aspect < 1 ? 1 / aspect : 1;
}

/**
 * Puts the camera where it sees the whole engine, and sets its clipping planes.
 *
 * Every distance is a multiple of the engine's radius, so the view is the same
 * whatever scale the model was exported at. A fixed near plane would instead cut
 * the engine away when zoomed in.
 */
function frameCamera(camera: PerspectiveCamera, radius: number, aspect: number): void {
  const startDistance = Math.min(
    ENGINE_CAMERA.START_DISTANCE * portraitDistanceScale(aspect),
    ENGINE_CAMERA.MAX_DISTANCE,
  );
  camera.position
    .set(...ENGINE_CAMERA.START_DIRECTION)
    .normalize()
    .multiplyScalar(radius * startDistance);
  camera.near = radius * ENGINE_CAMERA.NEAR;
  camera.far = radius * ENGINE_CAMERA.FAR;
  camera.lookAt(new Vector3());
  camera.updateProjectionMatrix();
}

/** Frames the engine and turns the mouse and touch into orbit, zoom and pan. */
export function EngineCameraRig({ radius }: Props) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);

  // Before paint, and before the controls read the camera's position as their start.
  // The aspect is read once, not tracked: a resize (a phone's address bar hiding)
  // must not throw away the view the user has orbited to.
  useLayoutEffect(
    () => frameCamera(camera, radius, size.width / size.height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera, radius],
  );

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={ENGINE_CAMERA.DAMPING_FACTOR}
      minDistance={radius * ENGINE_CAMERA.MIN_DISTANCE}
      maxDistance={radius * ENGINE_CAMERA.MAX_DISTANCE}
      // Zoom toward the point under the cursor, to get into a detail
      zoomToCursor
    />
  );
}
