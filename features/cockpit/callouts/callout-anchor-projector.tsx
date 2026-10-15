"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BEFORE_RENDER_PRIORITY } from "@/features/3d-scene/components/scene-render-pipeline";
import { Box3, Vector3, type Object3D } from "three/webgpu";
import { SHIP_OUTLINE_OBJECT_NAMES, type CalloutDefinition, type CalloutId } from "./callout-config";
import { calloutAnchors, publishAnchors, shipOutline } from "./callout-anchors";

/** Frames between looking again for a part not found yet: the ship loads after the scene. */
const RETRY_FRAMES = 30;

/** A part of the ship, and its centre in its own space: it rides the waves, so it is moved each frame. */
type Tracked = { object: Object3D; localCentre: Vector3 };
/** An object of the ship's outline, as slices along its length: each slice's corners in its own space. */
type Outlined = { object: Object3D; slices: Vector3[][] };

/**
 * Slices each outline object is cut into, along its longest side: a long
 * hull seen at an angle is a slanted band on screen, not the rectangle round it.
 */
const OUTLINE_SLICES = 10;

/** An object's bounding box, in its own space, cut into slices along its longest side: each slice's eight corners. */
function localSlicesOf(object: Object3D) {
  const worldBox = new Box3().setFromObject(object);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((corner) =>
    object.worldToLocal(
      new Vector3(
        corner & 1 ? worldBox.max.x : worldBox.min.x,
        corner & 2 ? worldBox.max.y : worldBox.min.y,
        corner & 4 ? worldBox.max.z : worldBox.min.z
      )
    )
  );
  const box = new Box3().setFromPoints(corners);
  const size = box.getSize(new Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
  return Array.from({ length: OUTLINE_SLICES }, (_, index) => {
    const slice = box.clone();
    slice.min[axis] = box.min[axis] + (size[axis] * index) / OUTLINE_SLICES;
    slice.max[axis] = box.min[axis] + (size[axis] * (index + 1)) / OUTLINE_SLICES;
    return [0, 1, 2, 3, 4, 5, 6, 7].map(
      (corner) =>
        new Vector3(
          corner & 1 ? slice.max.x : slice.min.x,
          corner & 2 ? slice.max.y : slice.min.y,
          corner & 4 ? slice.max.z : slice.min.z
        )
    );
  });
}

/**
 * Inside the Canvas: finds each callout's part of the ship and projects its
 * centre onto the screen every frame, for the overlay's lines
 * (`calloutAnchors`). Draws nothing.
 */
export function CalloutAnchorProjector({ callouts }: { callouts: CalloutDefinition[] }) {
  const tracked = useRef<Partial<Record<CalloutId, Tracked>>>({});
  const outlined = useRef<Outlined[]>([]);
  const framesSinceSearch = useRef(RETRY_FRAMES);
  const point = useRef(new Vector3());

  // Just before the render, with the camera and the ship where they will be
  // drawn: projected earlier, the dots trailed the ship's motion and, riding
  // with it, bobbed with the camera's tilt
  useFrame(({ scene, camera, size }) => {
    camera.updateMatrixWorld();
    framesSinceSearch.current++;
    for (const callout of callouts) {
      let part = tracked.current[callout.id];
      // Dropped when the model is swapped: its object leaves the scene
      if (part && !part.object.parent) part = tracked.current[callout.id] = undefined;
      if (!part && framesSinceSearch.current >= RETRY_FRAMES) {
        const object = scene.getObjectByName(callout.objectName);
        if (object) {
          const worldCentre = new Box3().setFromObject(object).getCenter(new Vector3());
          part = tracked.current[callout.id] = { object, localCentre: object.worldToLocal(worldCentre) };
        }
      }
      if (!part) {
        calloutAnchors[callout.id] = { x: 0, y: 0, isVisible: false };
        continue;
      }

      part.object.updateWorldMatrix(true, false);
      const projected = part.object.localToWorld(point.current.copy(part.localCentre)).project(camera);
      calloutAnchors[callout.id] = {
        x: ((projected.x + 1) / 2) * size.width,
        y: ((1 - projected.y) / 2) * size.height,
        // Behind the camera, or hidden from the tree: no line
        isVisible: projected.z < 1 && part.object.visible,
      };
    }
    // The ship's outline on screen: its hull, towers, sails and bridge, slice by slice
    outlined.current = outlined.current.filter(({ object }) => object.parent);
    if (outlined.current.length < SHIP_OUTLINE_OBJECT_NAMES.length && framesSinceSearch.current >= RETRY_FRAMES) {
      outlined.current = SHIP_OUTLINE_OBJECT_NAMES.flatMap((name) => {
        const object = scene.getObjectByName(name);
        return object ? [{ object, slices: localSlicesOf(object) }] : [];
      });
    }
    const slices: { x: number; y: number; width: number; height: number }[] = [];
    for (const { object, slices: localSlices } of outlined.current) {
      if (!object.visible) continue;
      object.updateWorldMatrix(true, false);
      for (const corners of localSlices) {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const corner of corners) {
          const projected = object.localToWorld(point.current.copy(corner)).project(camera);
          if (projected.z >= 1) continue;
          const x = ((projected.x + 1) / 2) * size.width;
          const y = ((1 - projected.y) / 2) * size.height;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
        if (Number.isFinite(left)) slices.push({ x: left, y: top, width: right - left, height: bottom - top });
      }
    }
    shipOutline.slices = slices;

    if (framesSinceSearch.current >= RETRY_FRAMES) framesSinceSearch.current = 0;
    publishAnchors();
  }, BEFORE_RENDER_PRIORITY);

  return null;
}
