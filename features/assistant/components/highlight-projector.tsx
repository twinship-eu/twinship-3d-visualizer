"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Vector3, type Object3D } from "three/webgpu";
import { BEFORE_RENDER_PRIORITY } from "@/features/3d-scene/components/scene-render-pipeline";
import { COMPONENT_OBJECT_NAMES } from "@/features/cockpit/cockpit-systems";
import { useOpenAnomaly } from "@/features/anomalies/lib/anomaly-store";
import { useAssistantState } from "../lib/assistant-store";
import { highlightAnchors, publishHighlightAnchors } from "../lib/highlight-anchors";

/** A highlighted part, found, and its centre in its own space: it rides the waves. */
type Tracked = { object: Object3D; localCentre: Vector3 };

/**
 * Inside the Canvas: projects the assistant's highlighted components (and an
 * open anomaly's members) onto the
 * screen every frame, just before the render, for their labels. Draws nothing.
 */
export function HighlightProjector() {
  const { highlights } = useAssistantState();
  // An open behaviour anomaly's members are projected too, for its pins on the ship
  const anomaly = useOpenAnomaly();
  const components = [...new Set([...highlights.map((highlight) => highlight.component), ...(anomaly?.anomaly?.members ?? [])])];
  // Found as they are asked for, by label: the ship is loaded by then
  const tracked = useRef(new Map<string, Tracked>());
  const point = useRef(new Vector3());

  useFrame(({ scene, camera, size }) => {
    if (components.length === 0) return;
    camera.updateMatrixWorld();
    for (const component of components) {
      let part = tracked.current.get(component);
      if (!part || !part.object.parent) {
        const object = scene.getObjectByName(COMPONENT_OBJECT_NAMES[component] ?? "");
        part = object ? { object, localCentre: object.worldToLocal(new Box3().setFromObject(object).getCenter(new Vector3())) } : undefined;
        if (part) tracked.current.set(component, part);
      }
      if (!part) {
        highlightAnchors[component] = { x: 0, y: 0, isVisible: false };
        continue;
      }
      part.object.updateWorldMatrix(true, false);
      const projected = part.object.localToWorld(point.current.copy(part.localCentre)).project(camera);
      highlightAnchors[component] = {
        x: ((projected.x + 1) / 2) * size.width,
        y: ((1 - projected.y) / 2) * size.height,
        isVisible: projected.z < 1 && part.object.visible,
      };
    }
    publishHighlightAnchors();
  }, BEFORE_RENDER_PRIORITY);

  return null;
}
