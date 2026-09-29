"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { color, normalLocal, positionLocal, uniform } from "three/tsl";
import { AdditiveBlending, BackSide, Box3, Mesh, MeshBasicNodeMaterial, Vector3, type Object3D, type UniformNode } from "three/webgpu";
import { BEFORE_RENDER_PRIORITY } from "@/features/3d-scene/components/scene-render-pipeline";
import { getActiveAlarms, useAlarmSilences, useLiveData } from "@/features/live-data/hooks/use-live-data";
import type { SensorState } from "@/features/live-data/live-data-sensors";
import { COMPONENT_OBJECT_NAMES } from "../cockpit-systems";
import { componentState } from "../component-live/component-state";
import { getAlarmBadges, publishBadgePositions, setAlarmBadges } from "./alarm-badge-anchors";

type GlowState = Exclude<SensorState, "normal">;

/** The glow's colours: the design's warning amber and alarm red. */
const GLOW_COLORS: Record<GlowState, string> = { warning: "#f5b544", alarm: "#f87171" };
/**
 * How bright the outline is at the height of its pulse, and at its low: over
 * 1, so the bloom (no threshold) spreads it into a halo. An alarm brighter.
 */
const GLOW_BRIGHTNESS: Record<GlowState, { low: number; high: number }> = {
  warning: { low: 1.5, high: 6 },
  alarm: { low: 2.5, high: 9 },
};
/**
 * How far the outline stands out from the part: a share of the part's size,
 * no wider than OUTLINE_MAX_WIDTH world units. (A fixed 0.4 read well on the
 * hull, and swelled the small engine into a blob; 0.18 was a hairline on the
 * hull.)
 */
const OUTLINE_SHARE_OF_SIZE = 0.012;
const OUTLINE_MAX_WIDTH = 0.4;
/**
 * The x-ray's brightness against the outline's: the part seen through what
 * hides it — the engine inside the hull — as a soft glow.
 */
const XRAY_SHARE = 0.4;
/** Pulses per second. */
const PULSE_HZ = 0.8;

type Brightness = UniformNode<"float", number>;

/** The brightness each state's pulse drives, shared by the outlines in that state. */
function createBrightness(): Record<GlowState, Brightness> {
  return { warning: uniform(GLOW_BRIGHTNESS.warning.high), alarm: uniform(GLOW_BRIGHTNESS.alarm.high) };
}

/**
 * An outline for a part: its back faces pushed out along the normals, in
 * solid colour — hidden behind the part but round its silhouette, and the
 * part keeps its own colours. (Light added over the part instead, it mixed
 * with the blue hull into a pinkish haze.)
 *
 * @param widthLocal how far out, in the part's own units
 */
function createOutlineMaterial(state: GlowState, brightness: Brightness, widthLocal: number) {
  const material = new MeshBasicNodeMaterial({ side: BackSide });
  material.positionNode = positionLocal.add(normalLocal.mul(widthLocal));
  material.colorNode = color(GLOW_COLORS[state]).mul(brightness);
  return material;
}

/**
 * The part seen through whatever is in front of it — drawn over everything,
 * added softly — so a part inside the hull still shows where it is.
 */
function createXrayMaterial(state: GlowState, brightness: Brightness) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  material.blending = AdditiveBlending;
  material.colorNode = color(GLOW_COLORS[state]).mul(brightness).mul(XRAY_SHARE);
  return material;
}

type Glowing = { componentLabel: string; object: Object3D; state: GlowState };

/** A glowing part, and the top of its bounding box in its own space, where its badge goes: it rides the waves. */
type BadgePoint = { object: Object3D; localTop: Vector3 };

/** The top centre of a part, in its own space. */
function localTopOf(object: Object3D) {
  const box = new Box3().setFromObject(object);
  const top = box.getCenter(new Vector3()).setY(box.max.y);
  return object.worldToLocal(top);
}

/** Adds an outline and an x-ray to every mesh of a part; returns what takes them off. */
function addOutline(object: Object3D, state: GlowState, brightness: Brightness) {
  const size = new Box3().setFromObject(object).getSize(new Vector3()).length();
  const widthWorld = Math.min(size * OUTLINE_SHARE_OF_SIZE, OUTLINE_MAX_WIDTH);
  const outlineMaterial = createOutlineMaterial(state, brightness, widthWorld / object.getWorldScale(new Vector3()).x);
  const xrayMaterial = createXrayMaterial(state, brightness);
  const added: Mesh[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.userData.isAlarmGlow) return;
    for (const [material, renderOrder] of [
      [outlineMaterial, 0],
      // Last, over the ship's own transparent parts
      [xrayMaterial, 20],
    ] as const) {
      const layer = new Mesh(mesh.geometry, material);
      layer.userData.isAlarmGlow = true;
      layer.renderOrder = renderOrder;
      layer.raycast = () => {};
      mesh.add(layer);
      added.push(layer);
    }
  });
  return () => {
    added.forEach((layer) => layer.removeFromParent());
    outlineMaterial.dispose();
    xrayMaterial.dispose();
  };
}

/**
 * Inside the Canvas, in Live data: the parts of the ship with an alarm
 * waiting for the operator are outlined — amber for a warning, red for an
 * alarm, spread by the bloom into a halo — and pulse. Acknowledged, the
 * outline goes; silenced, it goes for as long as the silence lasts.
 */
export function ComponentAlarmGlow() {
  const scene = useThree((state) => state.scene);
  const snapshot = useLiveData();
  const brightness = useMemo(createBrightness, []);

  const silences = useAlarmSilences();

  // Which parts glow, and how: those with an alarm waiting for the operator —
  // not acknowledged, not silenced. Recomputed with the data, once a second
  const glowing = useMemo<Glowing[]>(() => {
    if (!snapshot) return [];
    const waiting = getActiveAlarms(snapshot).filter((alarm) => (silences[alarm.id] ?? 0) <= snapshot.timestamp);
    return Object.entries(COMPONENT_OBJECT_NAMES).flatMap(([label, objectName]) => {
      const alarm = waiting.find((candidate) => candidate.componentLabel === label);
      if (!alarm) return [];
      // At least a warning; an alarm when its reading is past the alarm limit
      const state = componentState(label, snapshot, alarm);
      const object = scene.getObjectByName(objectName);
      return object && state !== "normal" ? [{ componentLabel: label, object, state }] : [];
    });
  }, [snapshot, scene, silences]);

  // The outlines, rebuilt only when which parts glow, or in what colour, changes
  const glowKey = glowing.map(({ object, state }) => `${object.uuid}:${state}`).join("|");
  const badgePoints = useRef<BadgePoint[]>([]);
  useEffect(() => {
    const removers = glowing.map(({ object, state }) => addOutline(object, state, brightness[state]));
    // Each glowing part's "!" badge, so it is clear why it glows
    badgePoints.current = glowing.map(({ object }) => ({ object, localTop: localTopOf(object) }));
    setAlarmBadges(glowing.map(({ componentLabel, state }) => ({ componentLabel, state })));
    return () => {
      removers.forEach((remove) => remove());
      badgePoints.current = [];
      setAlarmBadges([]);
    };
    // Keyed on what glows, not on each second's new array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey, brightness]);

  // The badges placed just before the render, as the callouts' dots are: with
  // the camera and the ship where they are drawn
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const badges = getAlarmBadges();
    if (badges.length === 0) return;
    camera.updateMatrixWorld();
    badgePoints.current.forEach(({ object, localTop }, index) => {
      const badge = badges[index];
      if (!badge) return;
      object.updateWorldMatrix(true, false);
      const projected = object.localToWorld(point.copy(localTop)).project(camera);
      badge.x = ((projected.x + 1) / 2) * size.width;
      badge.y = ((1 - projected.y) / 2) * size.height;
      badge.isVisible = projected.z < 1 && object.visible;
    });
    publishBadgePositions();
  }, BEFORE_RENDER_PRIORITY);

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * PULSE_HZ * 2 * Math.PI);
    for (const state of Object.keys(brightness) as GlowState[]) {
      const { low, high } = GLOW_BRIGHTNESS[state];
      brightness[state].value = low + (high - low) * pulse;
    }
  });

  return null;
}
