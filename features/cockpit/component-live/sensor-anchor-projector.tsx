"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BEFORE_RENDER_PRIORITY } from "@/features/3d-scene/components/scene-render-pipeline";
import { Box3, Vector3, type Object3D } from "three/webgpu";
import { sensorsOf } from "@/features/live-data/live-data-sensors";
import { publishAnchors, type CalloutAnchor } from "../callouts/callout-anchors";
import { COMPONENT_OBJECT_NAMES } from "../cockpit-systems";

/** Where each sensor of the selected component is on screen, by sensor id: written every frame. */
export const sensorAnchors: Record<string, CalloutAnchor> = {};

/** Frames between looking again for a part not found yet. */
const RETRY_FRAMES = 30;

type Tracked = { object: Object3D; localPoints: Record<string, Vector3> };

/**
 * Inside the Canvas: projects the selected component's sensors onto the
 * screen every frame (`sensorAnchors`). Each sensor sits at its share of the
 * part's bounding box (`SensorDefinition.position`), found once in the
 * part's own space so it rides the waves with it.
 */
export function SensorAnchorProjector({ componentLabel }: { componentLabel: string }) {
  const tracked = useRef<Tracked | null>(null);
  const framesSinceSearch = useRef(RETRY_FRAMES);
  const point = useRef(new Vector3());

  // Just before the render, with the camera and the ship where they will be
  // drawn: projected earlier, the dots trailed the ship's motion and, riding
  // with it, bobbed with the camera's tilt
  useFrame(({ scene, camera, size }) => {
    camera.updateMatrixWorld();
    const sensors = sensorsOf(componentLabel);
    const objectName = COMPONENT_OBJECT_NAMES[componentLabel];
    if (tracked.current && !tracked.current.object.parent) tracked.current = null;
    if (!tracked.current && objectName && ++framesSinceSearch.current >= RETRY_FRAMES) {
      framesSinceSearch.current = 0;
      const object = scene.getObjectByName(objectName);
      if (object) {
        const box = new Box3().setFromObject(object);
        const localPoints = Object.fromEntries(
          sensors.map((sensor) => {
            const [x, y, z] = sensor.position;
            const world = new Vector3(
              box.min.x + (box.max.x - box.min.x) * x,
              box.min.y + (box.max.y - box.min.y) * y,
              box.min.z + (box.max.z - box.min.z) * z
            );
            return [sensor.id, object.worldToLocal(world)];
          })
        );
        tracked.current = { object, localPoints };
      }
    }

    tracked.current?.object.updateWorldMatrix(true, false);
    for (const sensor of sensors) {
      const local = tracked.current?.localPoints[sensor.id];
      if (!tracked.current || !local) {
        sensorAnchors[sensor.id] = { x: 0, y: 0, isVisible: false };
        continue;
      }
      const projected = tracked.current.object.localToWorld(point.current.copy(local)).project(camera);
      sensorAnchors[sensor.id] = {
        x: ((projected.x + 1) / 2) * size.width,
        y: ((1 - projected.y) / 2) * size.height,
        isVisible: projected.z < 1,
      };
    }
    publishAnchors();
  }, BEFORE_RENDER_PRIORITY);

  return null;
}
