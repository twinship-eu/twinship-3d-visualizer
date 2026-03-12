import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { ShipTreeNode } from "../ship-visualizer-types";
import { Object3D } from "three";
import { easeOutCubic, findNodeByHitObject } from "../lib/3d-model";
import {
  FLOATING_BOB_AMPLITUDE,
  FLOATING_BOB_SPEED,
  FLOATING_PITCH_AMPLITUDE,
  FLOATING_ROLL_AMPLITUDE,
  FLOATING_TILT_SPEED,
  SHIP_IDLE_RESET_MS,
  SHIP_INTERACTION_Y_OFFSET,
  SHIP_TRANSITION_DURATION_MS,
  SHIP_VERTICAL_OFFSET,
} from "../ship-visualizer-config";
import ShipModel from "./ship-model";
import { useSceneInteraction } from "@/features/3d-scene/components/scene-interaction-context";

type ShipDisplayMode =
  | "animated"
  | "transitioning-to-interaction"
  | "interaction"
  | "transitioning-to-animated";

export default function Ship({
  modelPath,
  selectedStructureNode,
  hoveredStructureNode,
  hiddenNodeIds,
  onModelTreeLoaded,
  tree,
  onHover,
  onSelectByClick,
}: {
  modelPath: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  hiddenNodeIds?: Set<string>;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
  tree?: ShipTreeNode[] | null;
  onHover?: (node: ShipTreeNode | null) => void;
  onSelectByClick?: (node: ShipTreeNode | null) => void;
}) {
  const isPointerDown = useRef(false);
  const isDragging = useRef(false);
  const pointerDownAt = useRef({ x: 0, y: 0 });
  const floatGroupRef = useRef<Group>(null);
  const { isOrbitControlsActive } = useSceneInteraction();

  const [displayMode, setDisplayMode] = useState<ShipDisplayMode>("animated");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionStartTimeRef = useRef(0);
  const transitionStartCapturedRef = useRef(false);
  const transitionStartYRef = useRef(0);
  const transitionStartRotRef = useRef({ x: 0, z: 0 });

  const DRAG_THRESHOLD_PX = 4;
  const hasInteraction =
    selectedStructureNode !== null ||
    hoveredStructureNode !== null ||
    (hiddenNodeIds !== undefined && hiddenNodeIds.size > 0);

  useEffect(() => {
    if (hasInteraction && displayMode === "animated") {
      setDisplayMode("transitioning-to-interaction");
      transitionStartCapturedRef.current = false;
    }
  }, [hasInteraction, displayMode]);

  useEffect(() => {
    if (displayMode !== "interaction" || hasInteraction) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      setDisplayMode("transitioning-to-animated");
      transitionStartTimeRef.current = performance.now();
    }, SHIP_IDLE_RESET_MS);
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [displayMode, hasInteraction]);

  useFrame((state) => {
    const group = floatGroupRef.current;
    if (!group) return;

    const now = performance.now();
    const elapsed = now - transitionStartTimeRef.current;
    const t = Math.min(elapsed / SHIP_TRANSITION_DURATION_MS, 1);
    const eased = easeOutCubic(t);

    if (displayMode === "transitioning-to-interaction") {
      if (!transitionStartCapturedRef.current) {
        transitionStartYRef.current = group.position.y;
        transitionStartRotRef.current = { x: group.rotation.x, z: group.rotation.z };
        transitionStartTimeRef.current = now;
        transitionStartCapturedRef.current = true;
        return;
      }
      const startY = transitionStartYRef.current;
      const startRot = transitionStartRotRef.current;
      group.position.y = startY + eased * (SHIP_INTERACTION_Y_OFFSET - startY);
      group.rotation.x = startRot.x + eased * (0 - startRot.x);
      group.rotation.z = startRot.z + eased * (0 - startRot.z);
      if (t >= 1) {
        setDisplayMode("interaction");
      }
      return;
    }

    if (displayMode === "interaction") {
      group.position.y = SHIP_INTERACTION_Y_OFFSET;
      group.rotation.x = 0;
      group.rotation.z = 0;
      return;
    }

    if (displayMode === "transitioning-to-animated") {
      group.position.y =
        SHIP_INTERACTION_Y_OFFSET +
        eased * (SHIP_VERTICAL_OFFSET - SHIP_INTERACTION_Y_OFFSET);
      group.rotation.x = 0;
      group.rotation.z = 0;
      if (t >= 1) {
        setDisplayMode("animated");
      }
      return;
    }

    if (displayMode === "animated") {
      const time = state.clock.getElapsedTime();
      group.position.y =
        SHIP_VERTICAL_OFFSET + FLOATING_BOB_AMPLITUDE * Math.sin(time * FLOATING_BOB_SPEED);
      group.rotation.x = FLOATING_PITCH_AMPLITUDE * Math.sin(time * FLOATING_TILT_SPEED);
      group.rotation.z = FLOATING_ROLL_AMPLITUDE * Math.cos(time * FLOATING_TILT_SPEED * 1.1);
    }
  });

  const getClientCoords = (e: { nativeEvent?: { clientX: number; clientY: number }; clientX?: number; clientY?: number }) => {
    const n = e.nativeEvent;
    return { x: n?.clientX ?? e.clientX ?? 0, y: n?.clientY ?? e.clientY ?? 0 };
  };

  const handlePointerDown = useCallback(
    (e: { nativeEvent?: { clientX: number; clientY: number }; clientX?: number; clientY?: number }) => {
      isPointerDown.current = true;
      isDragging.current = false;
      const { x, y } = getClientCoords(e);
      pointerDownAt.current = { x, y };
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: {
      intersections: { object: Object3D }[];
      nativeEvent?: { clientX: number; clientY: number };
      clientX?: number;
      clientY?: number;
    }) => {
      if (isOrbitControlsActive) {
        if (onHover) onHover(null);
        return;
      }

      if (isPointerDown.current && !isDragging.current) {
        const { x, y } = getClientCoords(e);
        const dx = x - pointerDownAt.current.x;
        const dy = y - pointerDownAt.current.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          isDragging.current = true;
          if (onHover) onHover(null);
        }
      }
      if (isDragging.current) return;
      if (!tree?.length || !onHover) return;
      if (e.intersections.length === 0) {
        onHover(null);
        return;
      }

      let hoveredNode: ShipTreeNode | null = null;
      for (const { object } of e.intersections) {
        const node = findNodeByHitObject(tree, object);
        if (!node) continue;
        if (hiddenNodeIds?.has(node.id)) continue;
        hoveredNode = node;
        break;
      }

      onHover(hoveredNode);
    },
    [tree, onHover, isOrbitControlsActive, hiddenNodeIds]
  );

  const handlePointerUp = useCallback(() => {
    isPointerDown.current = false;
    isDragging.current = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    isPointerDown.current = false;
    isDragging.current = false;
    onHover?.(null);
  }, [onHover]);

  const handleClick = useCallback(
    (e: { intersections: { object: Object3D }[] }) => {
      if (isDragging.current) return;
      if (!tree?.length || !onSelectByClick || e.intersections.length === 0)
        return;

      let clickedNode: ShipTreeNode | null = null;
      for (const { object } of e.intersections) {
        const node = findNodeByHitObject(tree, object);
        if (!node) continue;
        if (hiddenNodeIds?.has(node.id)) continue;
        clickedNode = node;
        break;
      }

      if (clickedNode) onSelectByClick(clickedNode);
    },
    [tree, onSelectByClick, hiddenNodeIds]
  );

  return (
    <>
      <group
        ref={floatGroupRef}
        position={[0, SHIP_VERTICAL_OFFSET, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <Suspense
          fallback={
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2, 2, 2]} />
              <meshStandardMaterial color="gray" />
            </mesh>
          }
        >
          <ShipModel
            path={modelPath}
            selectedStructureNode={
              displayMode === "interaction" ? selectedStructureNode : null
            }
            hoveredStructureNode={
              displayMode === "interaction" ? (hoveredStructureNode ?? null) : null
            }
            hiddenNodeIds={hiddenNodeIds}
            onModelTreeLoaded={onModelTreeLoaded}
          />
        </Suspense>
      </group>
      
    </>
  );
}