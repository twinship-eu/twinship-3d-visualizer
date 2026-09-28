"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Quaternion, Vector3 } from "three/webgpu";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import { useCameraMotion } from "./camera-motion-context";
import { shipMotion } from "../lib/seascape-ship-motion";
import { asSceneRenderer, getSceneInspector } from "../lib/webgpu-renderer";

/**
 * How slowly `followShip` follows the ship's height, in seconds (the time
 * constant of the smoothing). Slower than the ship heaves, so the ship stays
 * centred over time but its heave still shows around the centre.
 */
const FOLLOW_SMOOTHING = 5;

/**
 * Live value behind the Inspector's Camera panel: the orbit keeps the ship
 * centred as it rises and falls, slowly enough that its heave still shows.
 *
 * Riding the ship — its heave, pitch and roll, so the sea and the horizon move
 * around the view — is for every user, from the button beside the zoom
 * controls (`useCameraMotion`).
 */
const CAMERA_TUNING = {
  followShip: true,
};

/**
 * Orbit controls update at priority -1 (drei), before the default 0. The ship's
 * tilt is taken off the camera before they run and put back after, so they
 * never see it and the user's orbit does not drift. Taken off by turning the
 * camera back, not by restoring a saved pose: a saved pose also undid whatever
 * moved the camera in between — the zoom buttons, the mouse wheel.
 */
const BEFORE_CONTROLS = -2;

/** The orbit controls' target, as drei's OrbitControls exposes it. */
type OrbitControlsLike = { target: Vector3 };

/**
 * Keeps the camera with the ship: see CAMERA_TUNING. The orbit itself — its
 * angle and distance — is always the user's.
 */
export function SceneCameraFollow() {
  // `get` rather than the camera and controls themselves: they are mutated
  // here, which react-hooks does not allow on values a hook handed out
  const get = useThree((state) => state.get);
  const { isRidingShip } = useCameraMotion();
  const isRidingShipRef = useRef(isRidingShip);
  useEffect(() => {
    isRidingShipRef.current = isRidingShip;
  }, [isRidingShip]);

  const stateRef = useRef({
    /** The height the orbit has been moved to follow, or null before the first frame. */
    followedY: null as number | null,
    /** The tilt put on the camera, and what it turned about, to take it off again. */
    tilt: null as { rotation: Quaternion; pivot: Vector3 } | null,
  });

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(get().gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Camera");
    panel.add(CAMERA_TUNING, "followShip");
  }, [get]);

  // Take the ship's tilt off the camera before the orbit controls update.
  // Only its position: the controls aim the camera afresh when they update
  useFrame(() => {
    const { tilt } = stateRef.current;
    if (!tilt) return;
    const { camera } = get();
    camera.position.sub(tilt.pivot).applyQuaternion(tilt.rotation.clone().invert()).add(tilt.pivot);
    stateRef.current.tilt = null;
  }, BEFORE_CONTROLS);

  useFrame((_, delta) => {
    const state = stateRef.current;
    const { camera, controls } = get();
    const target = (controls as OrbitControlsLike | null)?.target;
    const shipY = shipMotion.shipY;
    if (!target) return;
    if (state.followedY === null) {
      state.followedY = shipY;
      return;
    }

    // 1. Height: exactly the ship's when riding with it, a smoothed one when
    //    only keeping it centred, none otherwise
    let nextY = state.followedY;
    if (isRidingShipRef.current) {
      nextY = shipY;
    } else if (CAMERA_TUNING.followShip) {
      nextY += (shipY - nextY) * (1 - Math.exp(-delta / FOLLOW_SMOOTHING));
    }
    const moved = nextY - state.followedY;
    state.followedY = nextY;
    target.y += moved;
    camera.position.y += moved;

    // 2. Tilt: the ship's pitch and roll, turning the camera about the orbit's
    //    target — on the ship, and the point the zoom scales towards, so a zoom
    //    between frames and the tilt undo exactly
    if (!isRidingShipRef.current) return;
    const rotation = new Quaternion().setFromEuler(new Euler(shipMotion.pitch, 0, shipMotion.roll));
    const pivot = target.clone();
    camera.position.sub(pivot).applyQuaternion(rotation).add(pivot);
    camera.quaternion.premultiply(rotation);
    state.tilt = { rotation, pivot };
  });

  return null;
}
