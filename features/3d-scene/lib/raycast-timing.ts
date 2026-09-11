import { Mesh } from "three";
import { SCENE_STATS } from "./scene-stats-state";

/**
 * Times every mesh raycast in the scene, into SCENE_STATS.
 *
 * R3F raycasts on every pointer move to work out which object the pointer is
 * over, and three's raycaster walks triangles linearly with no acceleration
 * structure. On a ship of a few hundred thousand triangles that is main-thread
 * work, and it is invisible to the GPU profiler — the Inspector would show a
 * cheap frame while the browser is actually stuck in JavaScript.
 *
 * Patches the prototype rather than individual meshes because the model is
 * loaded asynchronously and cloned, so there is no single moment when every
 * mesh exists. Development only, and installed once.
 */

let isInstalled = false;

export function installRaycastTiming(): void {
  if (isInstalled || typeof performance === "undefined") return;
  isInstalled = true;

  const originalRaycast = Mesh.prototype.raycast;

  Mesh.prototype.raycast = function patchedRaycast(raycaster, intersects) {
    const startedAt = performance.now();
    originalRaycast.call(this, raycaster, intersects);
    SCENE_STATS.raycastMsTotal += performance.now() - startedAt;
    SCENE_STATS.raycastCallsTotal += 1;
  };
}
