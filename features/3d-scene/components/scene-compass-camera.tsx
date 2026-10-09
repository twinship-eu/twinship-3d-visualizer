"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three/webgpu";
import { liveSceneOverrides } from "../lib/live-scene-overrides";

/** How slowly the camera takes up a change of heading, seconds: the data's heading comes a second at a time. */
const HEADING_SMOOTHING_S = 1.5;
/**
 * After the ship's tilt is taken off the camera (-2) and before the orbit
 * controls update (-1): the orbit turned with the rest of the camera.
 */
const BEFORE_CONTROLS = -1.5;
const RADIANS_PER_DEGREE = Math.PI / 180;
const UP = new Vector3(0, 1, 0);

/** The orbit controls' target, as drei's OrbitControls exposes it. */
type OrbitControlsLike = { target: Vector3 };

/** The shortest turn from one bearing to another, degrees, -180 to 180. */
function turnBetween(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Inside the Canvas: holds the camera to a compass bearing while the ship
 * turns (`liveSceneOverrides.compassCamera`). The scene keeps the ship's bow
 * along +z whatever its heading, so a camera that stayed put would always see
 * it the same way: turning the orbit about the ship by each change of heading
 * keeps the camera looking the same way over the sea instead, and the ship
 * turns before it — a new heading reads as a new direction on the stage.
 * The user's orbit is kept: only the change of heading is added to it.
 */
export function SceneCompassCamera() {
  const get = useThree((state) => state.get);
  const followed = useRef<{ source: object; heading: number } | null>(null);
  const offset = useRef(new Vector3());

  useFrame((_, delta) => {
    const compass = liveSceneOverrides.compassCamera;
    const target = (get().controls as OrbitControlsLike | null)?.target;
    const heading = liveSceneOverrides.sun?.headingDeg;
    if (!compass || !target || heading === undefined) {
      followed.current = null;
      return;
    }
    // From the heading the camera's pose was set for: a new pose (a new setting), a new start
    if (followed.current?.source !== compass) followed.current = { source: compass, heading: compass.headingDeg };

    const state = followed.current;
    const step = turnBetween(state.heading, heading) * (1 - Math.exp(-delta / HEADING_SMOOTHING_S));
    if (Math.abs(step) < 1e-4) return;
    state.heading += step;
    // The ship turned to starboard by `step`: the camera's bearing off its bow falls by as much
    const { camera } = get();
    offset.current.copy(camera.position).sub(target).applyAxisAngle(UP, step * RADIANS_PER_DEGREE);
    camera.position.copy(target).add(offset.current);
  }, BEFORE_CONTROLS);

  return null;
}
