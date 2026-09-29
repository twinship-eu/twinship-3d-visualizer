"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Mesh, PerspectiveCamera, Quaternion, Vector3 } from "three/webgpu";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import {
  CONTROL_ROOM_OBJECT_NAME,
  EYE_START,
  FOV_STEP,
  HUD_PALETTES,
  LOOK_SPEED,
  PANE_SYSTEM_INFO,
  SCENE_FOV,
} from "../bridge-config";
import { buildBridgeGlass, type BridgeGlass } from "../lib/bridge-glass";
import { useBridgeState } from "../lib/bridge-store";
import { createBridgeWalk } from "../lib/bridge-walk";
import { drawHudWindow } from "../lib/draw-hud-pane";

/**
 * Where in the frame the camera is put: after the orbit controls (-1) and the
 * camera's following (0), before the callouts are projected (0.5) — which
 * read the camera where it will be drawn.
 */
const CAMERA_PRIORITY = 0.25;
const RADIANS_PER_DEGREE = Math.PI / 180;
/** Turned round to look over the bow: the camera looks down its own -z, the bow is +z. */
const FACING_BOW = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

type OrbitControlsLike = { enabled: boolean };

/**
 * Inside the Canvas: the bridge. While it is on, the camera stands in the
 * control room — riding the ship, turned all the way round by dragging,
 * walked about by the keys, zoomed by the wheel, never out of the room —
 * every window is glass, and the two front ones carry the HUD, redrawn with
 * each snapshot.
 */
export function BridgeView() {
  const get = useThree((state) => state.get);
  const { isActive, hudMode, isNight, windows } = useBridgeState();
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const glass = useRef<BridgeGlass | null>(null);
  const room = useRef<Mesh | null>(null);
  const walk = useRef(createBridgeWalk());

  // The glass, built on the first visit and kept: the room as modelled while the bridge is off
  useEffect(() => {
    if (!isActive) {
      glass.current?.setShown(false);
      return;
    }
    if (!glass.current) {
      const found = get().scene.getObjectByName(CONTROL_ROOM_OBJECT_NAME);
      glass.current = found instanceof Mesh ? buildBridgeGlass(found) : null;
      room.current = found instanceof Mesh ? found : null;
      if (!glass.current) console.warn(`Bridge: the model's ${CONTROL_ROOM_OBJECT_NAME} is not the one its windows were found in; no bridge.`);
    }
    glass.current?.setShown(true);
  }, [isActive, get]);
  useEffect(() => () => glass.current?.dispose(), []);

  // The orbit controls off while on the bridge; the scene's field of view back on leaving
  useEffect(() => {
    if (!isActive) return;
    const { controls, camera } = get();
    const orbit = controls as OrbitControlsLike | null;
    if (orbit) orbit.enabled = false;
    walk.current.reset();
    return () => {
      if (orbit) orbit.enabled = true;
      if (camera instanceof PerspectiveCamera) {
        camera.fov = SCENE_FOV;
        camera.updateProjectionMatrix();
      }
    };
  }, [isActive, get]);

  // Looking and walking about: drag to turn, the keys to walk, the wheel to zoom, a double click to start over
  useEffect(() => {
    if (!isActive) return;
    const element = get().gl.domElement;
    const state = walk.current;
    let dragFrom: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => {
      if (event.button === 0) dragFrom = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event: PointerEvent) => {
      if (!dragFrom) return;
      state.turn((event.clientX - dragFrom.x) * LOOK_SPEED, (event.clientY - dragFrom.y) * LOOK_SPEED);
      dragFrom = { x: event.clientX, y: event.clientY };
    };
    const onUp = () => {
      dragFrom = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      state.zoom(Math.sign(event.deltaY) * FOV_STEP);
    };
    const onKey = (isDown: boolean) => (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (state.press(event.code, isDown)) event.preventDefault();
    };
    const onKeyDown = onKey(true);
    const onKeyUp = onKey(false);
    const onDoubleClick = () => state.reset();
    element.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      state.release();
    };
  }, [isActive, get]);

  // The HUD, redrawn with each snapshot and on any change of what it shows
  useEffect(() => {
    const bridge = glass.current;
    if (!isActive || !bridge || !snapshot) return;
    const palette = isNight ? HUD_PALETTES.night : HUD_PALETTES.day;
    bridge.setNight(isNight);
    bridge.windows.forEach((window, index) => {
      const context = window.canvas.getContext("2d");
      if (!context) return;
      const cards = (windows[index] ?? [])
        .map((system) => {
          const componentLabel = PANE_SYSTEM_INFO[system].componentLabel;
          const isAlarmed = componentLabel !== null && activeAlarmOn(snapshot, componentLabel) !== null;
          return { system, snapshot, history, palette, isAlarmed };
        })
        .filter((card) => hudMode === "full" || (hudMode === "alarms" && card.isAlarmed));
      drawHudWindow(context, { cards });
      window.texture.needsUpdate = true;
    });
  }, [isActive, snapshot, history, hudMode, isNight, windows]);

  const pose = useRef({ eye: new Vector3(), rotation: new Quaternion(), turn: new Quaternion(), euler: new Euler(0, 0, 0, "YXZ") });
  useFrame((_, delta) => {
    const bridge = glass.current;
    const shell = room.current;
    if (!isActive || !bridge || !shell) return;
    const { camera } = get();
    const { eye, rotation, turn, euler } = pose.current;
    const state = walk.current.step(delta);
    // At the eye, as the ship carries the room; facing the bow, turned as the operator looks
    shell.updateWorldMatrix(true, false);
    shell.localToWorld(eye.set(state.x, EYE_START.y, state.z));
    shell.getWorldQuaternion(rotation);
    euler.set(state.pitch * RADIANS_PER_DEGREE, state.yaw * RADIANS_PER_DEGREE, 0, "YXZ");
    turn.setFromEuler(euler);
    camera.position.copy(eye);
    camera.quaternion.copy(rotation).multiply(FACING_BOW).multiply(turn);
    if (camera instanceof PerspectiveCamera && camera.fov !== state.fov) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }, CAMERA_PRIORITY);

  return null;
}

