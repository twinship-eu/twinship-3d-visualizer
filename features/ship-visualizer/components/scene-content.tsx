import { Suspense, useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { ShipTreeNode } from "../ship-visualizer-types";
import { Object3D } from "three";
import { findNodeByHitObject } from "../lib/3d-model";
import {
  FLOATING_BOB_AMPLITUDE,
  FLOATING_BOB_SPEED,
  FLOATING_PITCH_AMPLITUDE,
  FLOATING_ROLL_AMPLITUDE,
  FLOATING_TILT_SPEED,
  SHIP_VERTICAL_OFFSET,
} from "../ship-visualizer-config";
import ShipModel from "./ship-model";
import { useSceneInteraction } from "@/features/3d-scene/scene-interaction-context";

export default function Ship({
  modelPath,
  selectedStructureNode,
  hoveredStructureNode,
  onModelTreeLoaded,
  tree,
  onHover,
  onSelectByClick,
}: {
  modelPath: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
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

  const DRAG_THRESHOLD_PX = 4;

  useFrame((_, delta) => {
    const group = floatGroupRef.current;
    if (!group) return;
    const t = performance.now() * 0.001;
    group.position.y =
      SHIP_VERTICAL_OFFSET + FLOATING_BOB_AMPLITUDE * Math.sin(t * FLOATING_BOB_SPEED);
    group.rotation.x = FLOATING_PITCH_AMPLITUDE * Math.sin(t * FLOATING_TILT_SPEED);
    group.rotation.z = FLOATING_ROLL_AMPLITUDE * Math.cos(t * FLOATING_TILT_SPEED * 1.1);
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
      const hit = e.intersections[0].object;
      const node = findNodeByHitObject(tree, hit);
      onHover(node ?? null);
    },
    [tree, onHover, isOrbitControlsActive]
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
      const hit = e.intersections[0].object;
      console.log(hit)
      const node = findNodeByHitObject(tree, hit);
      if (node) onSelectByClick(node);
    },
    [tree, onSelectByClick]
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
            selectedStructureNode={selectedStructureNode}
            hoveredStructureNode={hoveredStructureNode ?? null}
            onModelTreeLoaded={onModelTreeLoaded}
          />
        </Suspense>
      </group>
      
    </>
  );
}