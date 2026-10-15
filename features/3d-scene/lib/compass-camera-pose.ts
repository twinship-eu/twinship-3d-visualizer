import { Vector3 } from "three/webgpu";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/features/ship-visualizer/ship-visualizer-config";
import { liveSceneOverrides } from "./live-scene-overrides";

type Point = [number, number, number];
type Pose = { position: Point; target: Point };

const DEGREES_PER_RADIAN = 180 / Math.PI;
const UP = new Vector3(0, 1, 0);

/**
 * A camera pose turned about its target to look towards a compass bearing,
 * for a ship on a heading. The scene keeps the bow along +z, starboard -x:
 * the pose's own bearing off the bow is where it looks from its position to
 * its target, and it is turned until that bearing and the heading add up to
 * the one asked for. Its height and distance stay.
 */
/** Where a pose looks off the bow, clockwise, degrees: from its position to its target. */
export function offBowBearingDeg(pose: Pose) {
  const offset = new Vector3(...pose.position).sub(new Vector3(...pose.target));
  // Looking along -offset: (-sin r, cos r) for r clockwise off the bow
  return Math.atan2(offset.x, -offset.z) * DEGREES_PER_RADIAN;
}

export function poseLookingTowards(pose: Pose, bearingDeg: number, headingDeg: number): Pose {
  const target = new Vector3(...pose.target);
  const offset = new Vector3(...pose.position).sub(target);
  const offBowDeg = offBowBearingDeg(pose);
  const wantedDeg = bearingDeg - headingDeg;
  // Turned about +y by θ, the bearing off the bow falls by θ
  offset.applyAxisAngle(UP, ((offBowDeg - wantedDeg) * Math.PI) / 180);
  const position = target.clone().add(offset);
  return { position: [position.x, position.y, position.z], target: pose.target };
}

/**
 * The view to go back to — reset, or a part let go: the ship's default view,
 * or with the camera held to a compass bearing (Live data) that view turned
 * for the heading now, and made the new start of the turns the camera follows.
 */
export function homeCameraPose(): Pose {
  const pose: Pose = { position: DEFAULT_CAMERA_POSITION, target: DEFAULT_CAMERA_TARGET };
  const compass = liveSceneOverrides.compassCamera;
  const heading = liveSceneOverrides.sun?.headingDeg;
  if (!compass || heading === undefined) return pose;
  liveSceneOverrides.compassCamera = { ...compass, headingDeg: heading };
  return poseLookingTowards(pose, compass.bearingDeg, heading);
}
