import { EYE_START, FOV_LIMITS, LOOK_LIMITS, WALK_SPEED, WALKABLE_AREAS } from "../bridge-config";

const RADIANS_PER_DEGREE = Math.PI / 180;

/** The keys that walk, and which way: forward and back, left and right, as the eye faces. */
const KEYS: Record<string, { forward: number; right: number }> = {
  KeyW: { forward: 1, right: 0 },
  ArrowUp: { forward: 1, right: 0 },
  KeyS: { forward: -1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  KeyA: { forward: 0, right: -1 },
  ArrowLeft: { forward: 0, right: -1 },
  KeyD: { forward: 0, right: 1 },
  ArrowRight: { forward: 0, right: 1 },
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The nearest point of the room's floor to one: inside one of its walkable areas. */
function onTheFloor(x: number, z: number) {
  let best = { x, z, distance: Infinity };
  for (const area of WALKABLE_AREAS) {
    const nearX = clamp(x, area.x[0], area.x[1]);
    const nearZ = clamp(z, area.z[0], area.z[1]);
    const distance = Math.hypot(nearX - x, nearZ - z);
    if (distance < best.distance) best = { x: nearX, z: nearZ, distance };
  }
  return best;
}

/**
 * The operator on the bridge: where they stand on its floor, in the room's
 * own space, which way they look, how far they zoom — turned by dragging,
 * walked by the keys, never off the floor.
 */
export function createBridgeWalk() {
  const state = { x: EYE_START.x as number, z: EYE_START.z as number, yaw: 0, pitch: 0, fov: FOV_LIMITS.widest as number };
  const held = new Set<string>();

  return {
    reset() {
      Object.assign(state, { x: EYE_START.x, z: EYE_START.z, yaw: 0, pitch: 0, fov: FOV_LIMITS.widest });
    },
    /** Turns the view by what was dragged, in degrees: round and round, up and down within limits. */
    turn(right: number, down: number) {
      state.yaw = (state.yaw - right) % 360;
      state.pitch = clamp(state.pitch - down, -LOOK_LIMITS.pitchDown, LOOK_LIMITS.pitchUp);
    },
    zoom(by: number) {
      state.fov = clamp(state.fov + by, FOV_LIMITS.narrowest, FOV_LIMITS.widest);
    },
    /** A walking key down or up; whether it is one. */
    press(code: string, isDown: boolean) {
      if (!KEYS[code]) return false;
      if (isDown) held.add(code);
      else held.delete(code);
      return true;
    },
    release() {
      held.clear();
    },
    /** Walks on for a frame, as the held keys say, and says where the eye is. */
    step(delta: number) {
      let forward = 0;
      let right = 0;
      held.forEach((code) => {
        forward += KEYS[code].forward;
        right += KEYS[code].right;
      });
      if (forward !== 0 || right !== 0) {
        // Facing the bow (+z) at yaw 0; the view's right is then -x
        const yaw = state.yaw * RADIANS_PER_DEGREE;
        const step = (WALK_SPEED * delta) / Math.hypot(forward, right);
        const x = state.x + (forward * Math.sin(yaw) - right * Math.cos(yaw)) * step;
        const z = state.z + (forward * Math.cos(yaw) + right * Math.sin(yaw)) * step;
        const floor = onTheFloor(x, z);
        state.x = floor.x;
        state.z = floor.z;
      }
      return state;
    },
  };
}
