"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three/webgpu";
import { activeAlarmOn, useLiveData, useLiveHistory } from "@/features/live-data/hooks/use-live-data";
import {
  CONTROL_ROOM_OBJECT_NAME,
  FOV_LIMITS,
  FOV_STEP,
  HUD_PALETTES,
  LOOK_LIMITS,
  LOOK_SPEED,
  PANE_SYSTEM_INFO,
  SCENE_FOV,
} from "../bridge-config";
import { buildBridgeGlass, type BridgeGlass } from "../lib/bridge-glass";
import { useBridgeState } from "../lib/bridge-store";
import { drawHudPane } from "../lib/draw-hud-pane";

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
 * control room — riding the ship, turned by dragging, zoomed by the wheel,
 * never out of the room — and the windows carry the HUD, redrawn with each
 * snapshot.
 */
export function BridgeView() {
  const get = useThree((state) => state.get);
  const { isActive, hudMode, isNight, panes: paneSystems } = useBridgeState();
  const snapshot = useLiveData();
  const history = useLiveHistory();
  const glass = useRef<BridgeGlass | null>(null);
  const look = useRef({ yaw: 0, pitch: 0, fov: FOV_LIMITS.widest as number });

  // The glass, built on the first visit and kept: hidden while the bridge is off
  useEffect(() => {
    if (!isActive) {
      glass.current?.setShown(false);
      return;
    }
    if (!glass.current) {
      const room = get().scene.getObjectByName(CONTROL_ROOM_OBJECT_NAME);
      if (!room) {
        console.warn(`Bridge: no ${CONTROL_ROOM_OBJECT_NAME} in the model; the bridge view has no room to stand in.`);
        return;
      }
      glass.current = buildBridgeGlass(room);
    }
    glass.current.setShown(true);
  }, [isActive, get]);
  useEffect(() => () => glass.current?.dispose(), []);

  // The orbit controls off while on the bridge; the scene's field of view back on leaving
  useEffect(() => {
    const { controls, camera } = get();
    const orbit = controls as OrbitControlsLike | null;
    if (!isActive) return;
    if (orbit) orbit.enabled = false;
    look.current = { yaw: 0, pitch: 0, fov: FOV_LIMITS.widest };
    return () => {
      if (orbit) orbit.enabled = true;
      if (camera instanceof PerspectiveCamera) {
        camera.fov = SCENE_FOV;
        camera.updateProjectionMatrix();
      }
    };
  }, [isActive, get]);

  // Looking about: drag to turn, the wheel to zoom, a double click to look ahead again
  useEffect(() => {
    if (!isActive) return;
    const element = get().gl.domElement;
    let dragFrom: { x: number; y: number } | null = null;
    const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
    const onDown = (event: PointerEvent) => {
      if (event.button === 0) dragFrom = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event: PointerEvent) => {
      if (!dragFrom) return;
      const state = look.current;
      state.yaw = clamp(state.yaw - (event.clientX - dragFrom.x) * LOOK_SPEED, -LOOK_LIMITS.yaw, LOOK_LIMITS.yaw);
      state.pitch = clamp(state.pitch - (event.clientY - dragFrom.y) * LOOK_SPEED, -LOOK_LIMITS.pitchDown, LOOK_LIMITS.pitchUp);
      dragFrom = { x: event.clientX, y: event.clientY };
    };
    const onUp = () => {
      dragFrom = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      look.current.fov = clamp(look.current.fov + Math.sign(event.deltaY) * FOV_STEP, FOV_LIMITS.narrowest, FOV_LIMITS.widest);
    };
    const onDoubleClick = () => {
      look.current = { yaw: 0, pitch: 0, fov: FOV_LIMITS.widest };
    };
    element.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("dblclick", onDoubleClick);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("dblclick", onDoubleClick);
    };
  }, [isActive, get]);

  // The HUD, redrawn with each snapshot and on any change of what it shows
  useEffect(() => {
    const bridge = glass.current;
    if (!isActive || !bridge || !snapshot) return;
    const palette = isNight ? HUD_PALETTES.night : HUD_PALETTES.day;
    bridge.setNight(isNight);
    bridge.panes.forEach((pane, index) => {
      const context = pane.canvas.getContext("2d");
      const system = paneSystems[index];
      if (!context || !system) return;
      const componentLabel = PANE_SYSTEM_INFO[system].componentLabel;
      const isAlarmed = componentLabel !== null && activeAlarmOn(snapshot, componentLabel) !== null;
      const isBlank = hudMode === "clear" || (hudMode === "alarms" && !isAlarmed);
      drawHudPane(context, { index, system, snapshot, history, palette, isAlarmed, isBlank });
      pane.texture.needsUpdate = true;
    });
  }, [isActive, snapshot, history, hudMode, isNight, paneSystems]);

  const pose = useRef({ position: new Vector3(), rotation: new Quaternion(), turn: new Quaternion(), euler: new Euler(0, 0, 0, "YXZ") });
  useFrame(() => {
    const bridge = glass.current;
    if (!isActive || !bridge) return;
    const { camera } = get();
    const { position, rotation, turn, euler } = pose.current;
    // At the eye, as the ship carries it; facing the bow, turned as the operator looks
    bridge.rig.updateWorldMatrix(true, false);
    bridge.rig.localToWorld(position.copy(bridge.eye));
    bridge.rig.getWorldQuaternion(rotation);
    euler.set(look.current.pitch * RADIANS_PER_DEGREE, look.current.yaw * RADIANS_PER_DEGREE, 0, "YXZ");
    turn.setFromEuler(euler);
    camera.position.copy(position);
    camera.quaternion.copy(rotation).multiply(FACING_BOW).multiply(turn);
    if (camera instanceof PerspectiveCamera && camera.fov !== look.current.fov) {
      camera.fov = look.current.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }, CAMERA_PRIORITY);

  return null;
}
