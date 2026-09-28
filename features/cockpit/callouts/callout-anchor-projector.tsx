"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Vector3, type Object3D } from "three/webgpu";
import type { CalloutDefinition, CalloutId } from "./callout-config";
import { calloutAnchors } from "./callout-anchors";

/** Frames between looking again for a part not found yet: the ship loads after the scene. */
const RETRY_FRAMES = 30;

/** A part of the ship, and its centre in its own space: it rides the waves, so it is moved each frame. */
type Tracked = { object: Object3D; localCentre: Vector3 };

/**
 * Inside the Canvas: finds each callout's part of the ship and projects its
 * centre onto the screen every frame, for the overlay's lines
 * (`calloutAnchors`). Draws nothing.
 */
export function CalloutAnchorProjector({ callouts }: { callouts: CalloutDefinition[] }) {
  const tracked = useRef<Partial<Record<CalloutId, Tracked>>>({});
  const framesSinceSearch = useRef(RETRY_FRAMES);
  const point = useRef(new Vector3());

  useFrame(({ scene, camera, size }) => {
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

      const projected = part.object.localToWorld(point.current.copy(part.localCentre)).project(camera);
      calloutAnchors[callout.id] = {
        x: ((projected.x + 1) / 2) * size.width,
        y: ((1 - projected.y) / 2) * size.height,
        // Behind the camera, or hidden from the tree: no line
        isVisible: projected.z < 1 && part.object.visible,
      };
    }
    if (framesSinceSearch.current >= RETRY_FRAMES) framesSinceSearch.current = 0;
  });

  return null;
}
