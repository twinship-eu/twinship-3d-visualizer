"use client";

import { Suspense, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, useFBX } from "@react-three/drei";
import {
  Box3,
  Color,
  DoubleSide,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import type { RootState } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SHIP_MODEL_PATH,
  SHIP_COLOR,
  SELECTED_PART_COLOR,
  SHIP_MODEL_SCALE,
  UNSELECTED_PART_OPACITY,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  CAMERA_TRANSITION_DURATION_S,
} from "../ship-visualizer-config";
import type { ShipTreeNode } from "../ship-visualizer-types";

function useTabVisible() {
  const [visible, setVisible] = useState(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );
  useEffect(() => {
    const handleVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
  return visible;
}

function getObjectByUuid(root: Object3D, uuid: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((obj) => {
    if (String(obj.uuid) === uuid) found = obj;
  });
  return found;
}

function collectMeshUuids(obj: Object3D, set: Set<string>): void {
  obj.traverse((o) => {
    if ((o as Mesh).isMesh) set.add(String(o.uuid));
  });
}

/** Returns the set of mesh uuids that should be highlighted (selected node + adjacent siblings). */
function getMatchingMeshUuids(root: Group, node: ShipTreeNode): Set<string> {
  const set = new Set<string>();
  if (node.objectUuid !== undefined) {
    const obj = getObjectByUuid(root, node.objectUuid);
    if (obj) {
      const parent = obj.parent;
      if (parent && parent !== root) {
        parent.children.forEach((child) => collectMeshUuids(child, set));
      } else {
        collectMeshUuids(obj, set);
      }
    }
    if (set.size > 0) return set;
  }
  root.traverse((o) => {
    if ((o as Mesh).isMesh && meshMatchesNodeByName(o as Mesh, node)) {
      set.add(String(o.uuid));
    }
  });
  return set;
}

function meshMatchesNodeByName(mesh: { name: string }, node: ShipTreeNode): boolean {
  const nameLower = mesh.name.toLowerCase().trim();
  if (!nameLower) return false;
  const labelLower = node.label.toLowerCase().trim();
  if (labelLower && nameLower.includes(labelLower)) return true;
  const idParts = node.id.split("-");
  return idParts.some((part) => part.length > 1 && nameLower.includes(part.toLowerCase()));
}

function buildNode(obj: Object3D): ShipTreeNode {
  const children = obj.children.length > 0 ? obj.children.map((c) => buildNode(c)) : undefined;
  const uuid = String(obj.uuid);
  return {
    id: uuid,
    label: (obj.name && obj.name.trim()) || "Unnamed",
    objectUuid: uuid,
    children,
  };
}

/** Build a tree from the loaded model’s scene graph so the panel reflects the real ship structure. */
function buildTreeFromModel(root: Group): ShipTreeNode[] {
  return root.children.map((child) => buildNode(child));
}

function applySelectionOpacity(
  root: Group,
  selectedNode: ShipTreeNode | null,
  hoveredNode: ShipTreeNode | null,
  unselectedOpacity: number
) {
  const white = new Color(SHIP_COLOR);
  const selectedColor = new Color(SELECTED_PART_COLOR);

  if (selectedNode === null && hoveredNode === null) {
    root.traverse((child) => {
      if ("material" in child && (child as Mesh).material) {
        const mesh = child as Mesh;
        mesh.renderOrder = 0;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m: Material) => {
          m.transparent = false;
          if ("opacity" in m) (m as Material & { opacity: number }).opacity = 1;
          if ("color" in m && (m as Material & { color: Color }).color)
            (m as Material & { color: Color }).color.copy(white);
        });
      }
    });
    return;
  }

  const selectedUuids =
    selectedNode !== null ? getMatchingMeshUuids(root, selectedNode) : new Set<string>();
  const hoveredUuids =
    hoveredNode !== null ? getMatchingMeshUuids(root, hoveredNode) : new Set<string>();
  const hasSelection = selectedUuids.size > 0;
  const hasHover = hoveredUuids.size > 0;
  if (!hasSelection && !hasHover) return;

  root.traverse((child) => {
    if ("material" in child && (child as Mesh).material) {
      const mesh = child as Mesh;
      const meshId = String(mesh.uuid);
      const isSelected = selectedUuids.has(meshId);
      const isHovered = hoveredUuids.has(meshId);

      mesh.renderOrder = isSelected ? 1 : 0;

      let opacity: number;
      let color: Color;
      if (isSelected && isHovered) {
        opacity = unselectedOpacity;
        color = selectedColor;
      } else if (isSelected) {
        opacity = 1;
        color = selectedColor;
      } else if (isHovered) {
        opacity = 1;
        color = selectedColor;
      } else {
        opacity = unselectedOpacity;
        color = white;
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m: Material) => {
        m.transparent = hasSelection || hasHover;
        if ("opacity" in m) (m as Material & { opacity: number }).opacity = opacity;
        if ("color" in m && (m as Material & { color: Color }).color)
          (m as Material & { color: Color }).color.copy(color);
      });
    }
  });
}

function applyShipMaterial(clone: Group, shipColor: Color) {
  clone.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
    if ("material" in child && (child as Mesh).material) {
      const mesh = child as Mesh;
      const mat = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
      const applyMaterial = (m: Material) => {
        if ("color" in m && m.color instanceof Color) m.color.copy(shipColor);
        (m as Material & { side?: number }).side = DoubleSide;
      };
      if (Array.isArray(mat)) {
        mat.forEach(applyMaterial);
        mesh.material = mat;
      } else {
        applyMaterial(mat);
        mesh.material = mat;
      }
    }
  });
}

const CAMERA_FIT_PADDING = 1.5;
const MIN_CAMERA_DISTANCE = 2;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function CameraFitToSelection({
  root,
  selectedNode,
}: {
  root: Group;
  selectedNode: ShipTreeNode | null;
}) {
  const { camera, controls } = useThree();
  const fitPending = useRef(false);
  const resetPending = useRef(false);
  const animating = useRef(false);
  const progress = useRef(0);
  const startPosition = useRef(new Vector3());
  const endPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const endTarget = useRef(new Vector3());

  useEffect(() => {
    if (selectedNode) {
      fitPending.current = true;
    } else {
      resetPending.current = true;
    }
  }, [selectedNode]);

  useFrame((_, delta) => {
    const ctrl = controls as { target?: Vector3 };
    const targetObj = ctrl?.target;

    if (resetPending.current && targetObj) {
      startPosition.current.copy(camera.position);
      startTarget.current.copy(targetObj);
      endPosition.current.set(
        DEFAULT_CAMERA_POSITION[0],
        DEFAULT_CAMERA_POSITION[1],
        DEFAULT_CAMERA_POSITION[2]
      );
      endTarget.current.set(
        DEFAULT_CAMERA_TARGET[0],
        DEFAULT_CAMERA_TARGET[1],
        DEFAULT_CAMERA_TARGET[2]
      );
      progress.current = 0;
      animating.current = true;
      resetPending.current = false;
    }

    if (fitPending.current && selectedNode && targetObj) {
      root.updateMatrixWorld(true);
      const matchingUuids = getMatchingMeshUuids(root, selectedNode);
      const box = new Box3();
      let hasMatch = false;
      root.traverse((child) => {
        if ((child as Mesh).isMesh && matchingUuids.has(String((child as Mesh).uuid))) {
          const mesh = child as Mesh;
          if (mesh.geometry?.boundingBox) {
            mesh.geometry.computeBoundingBox();
            const meshBox = mesh.geometry.boundingBox!.clone();
            meshBox.applyMatrix4(mesh.matrixWorld);
            box.union(meshBox);
            hasMatch = true;
          } else {
            box.expandByObject(mesh);
            hasMatch = true;
          }
        }
      });
      if (hasMatch && !box.isEmpty()) {
        const partCenter = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const fov = (camera as { fov?: number }).fov ?? 45;
        const distance = (CAMERA_FIT_PADDING * maxDim) / (2 * Math.tan((fov * Math.PI) / 360));
        const dist = Math.max(distance, MIN_CAMERA_DISTANCE);
        const shipBox = new Box3().setFromObject(root);
        const shipCenter = shipBox.getCenter(new Vector3());
        const toCamera = partCenter.clone().sub(shipCenter);
        if (toCamera.lengthSq() < 1e-6) {
          toCamera.set(1, 1, 1).normalize();
        } else {
          toCamera.normalize();
        }
        startPosition.current.copy(camera.position);
        startTarget.current.copy(targetObj);
        endTarget.current.copy(partCenter);
        endPosition.current.copy(partCenter).add(toCamera.multiplyScalar(dist));
        progress.current = 0;
        animating.current = true;
      }
      fitPending.current = false;
    }

    if (animating.current && targetObj) {
      progress.current += delta / CAMERA_TRANSITION_DURATION_S;
      const t = Math.min(1, progress.current);
      const eased = easeOutCubic(t);
      camera.position.lerpVectors(startPosition.current, endPosition.current, eased);
      targetObj.lerpVectors(startTarget.current, endTarget.current, eased);
      if (t >= 1) animating.current = false;
    }
  });

  return null;
}

function findNodeByHitObject(nodes: ShipTreeNode[], hitObject: Object3D): ShipTreeNode | null {
  const uuidSet = new Set<string>();
  let obj: Object3D | null = hitObject;
  while (obj) {
    uuidSet.add(String(obj.uuid));
    obj = obj.parent;
  }
  function search(nodelist: ShipTreeNode[]): ShipTreeNode | null {
    for (const node of nodelist) {
      if (node.modelPath) continue;
      if (node.objectUuid !== undefined && uuidSet.has(node.objectUuid)) return node;
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(nodes);
}

function GltfShipModel({
  path,
  selectedStructureNode,
  hoveredStructureNode,
  onModelTreeLoaded,
}: {
  path: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
}) {
  const gltf = useGLTF(path);
  const cloned = useMemo(() => {
    const clone = gltf.scene.clone();
    applyShipMaterial(clone, new Color(SHIP_COLOR));
    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    if (cloned && onModelTreeLoaded) {
      onModelTreeLoaded(buildTreeFromModel(cloned));
    }
  }, [cloned, onModelTreeLoaded]);

  useEffect(() => {
    if (!cloned) return;
    applySelectionOpacity(
      cloned,
      selectedStructureNode,
      hoveredStructureNode,
      UNSELECTED_PART_OPACITY
    );
  }, [cloned, selectedStructureNode, hoveredStructureNode]);

  return (
    <>
      <CameraFitToSelection root={cloned} selectedNode={selectedStructureNode} />
      <primitive
        object={cloned as Group}
        scale={SHIP_MODEL_SCALE}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}

function FbxShipModel({
  path,
  selectedStructureNode,
  hoveredStructureNode,
  onModelTreeLoaded,
}: {
  path: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
}) {
  const fbx = useFBX(path);
  const cloned = useMemo(() => {
    const clone = fbx.clone();
    applyShipMaterial(clone, new Color(SHIP_COLOR));
    return clone;
  }, [fbx]);

  useEffect(() => {
    if (cloned && onModelTreeLoaded) {
      onModelTreeLoaded(buildTreeFromModel(cloned));
    }
  }, [cloned, onModelTreeLoaded]);

  useEffect(() => {
    if (!cloned) return;
    applySelectionOpacity(
      cloned,
      selectedStructureNode,
      hoveredStructureNode,
      UNSELECTED_PART_OPACITY
    );
  }, [cloned, selectedStructureNode, hoveredStructureNode]);

  return (
    <>
      <CameraFitToSelection root={cloned} selectedNode={selectedStructureNode} />
      <primitive
        object={cloned as Group}
        scale={SHIP_MODEL_SCALE}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}

const FBX_EXT = ".fbx";

function ShipModel({
  path,
  selectedStructureNode,
  hoveredStructureNode,
  onModelTreeLoaded,
}: {
  path: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
}) {
  const isFbx = path.toLowerCase().endsWith(FBX_EXT);
  return isFbx ? (
    <FbxShipModel
      path={path}
      selectedStructureNode={selectedStructureNode}
      hoveredStructureNode={hoveredStructureNode}
      onModelTreeLoaded={onModelTreeLoaded}
    />
  ) : (
    <GltfShipModel
      path={path}
      selectedStructureNode={selectedStructureNode}
      hoveredStructureNode={hoveredStructureNode}
      onModelTreeLoaded={onModelTreeLoaded}
    />
  );
}

function SceneContent({
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

  const DRAG_THRESHOLD_PX = 4;

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
      if (isPointerDown.current && !isDragging.current) {
        const { x, y } = getClientCoords(e);
        const dx = x - pointerDownAt.current.x;
        const dy = y - pointerDownAt.current.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          isDragging.current = true;
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
    [tree, onHover]
  );

  const handlePointerUp = useCallback(() => {
    isPointerDown.current = false;
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
      const node = findNodeByHitObject(tree, hit);
      if (node) onSelectByClick(node);
    },
    [tree, onSelectByClick]
  );

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[100, 100, 50]}
        intensity={1.2}
        // castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <directionalLight position={[-50, 50, -50]} intensity={0.4} />
      <Environment preset="city" />
      <group
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
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={400}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

type Props = {
  modelPath?: string;
  selectedStructureNode?: ShipTreeNode | null;
  hoveredStructureNode?: ShipTreeNode | null;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
  tree?: ShipTreeNode[] | null;
  onHover?: (node: ShipTreeNode | null) => void;
  onSelectByClick?: (node: ShipTreeNode | null) => void;
  className?: string;
};

const FALLBACK_CLASS =
  "h-full w-full min-h-0 rounded-lg overflow-hidden flex flex-col items-center justify-center gap-3 text-gray-400";

export function ShipScene({
  modelPath = DEFAULT_SHIP_MODEL_PATH,
  selectedStructureNode = null,
  hoveredStructureNode = null,
  onModelTreeLoaded,
  tree = null,
  onHover,
  onSelectByClick,
  className,
}: Props) {
  const tabVisible = useTabVisible();
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const onCreated = useCallback((state: RootState) => {
    const canvas = state.gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
  }, []);

  const tryAgain = useCallback(() => {
    setContextLost(false);
    setCanvasKey((k) => k + 1);
  }, []);

  if (contextLost) {
    return (
      <div className={className ?? FALLBACK_CLASS}>
        <p>Graphics context lost.</p>
        <p className="text-sm">The 3D view was reset to avoid errors.</p>
        <button
          type="button"
          onClick={tryAgain}
          className="bg-primary rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!tabVisible) {
    return (
      <div className={cn(className ?? FALLBACK_CLASS, "bg-white")}>
        <p className="text-sm">3D view paused (tab in background).</p>
        <p className="text-xs">Switch back to this tab to restore.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(className ?? "h-full min-h-0 w-full overflow-hidden rounded-lg", "bg-white")}
    >
      <Canvas
        key={`ship-canvas-${canvasKey}`}
        shadows
        camera={{
          position: [...DEFAULT_CAMERA_POSITION],
          fov: 45,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={onCreated}
      >
        <SceneContent
          modelPath={modelPath}
          selectedStructureNode={selectedStructureNode}
          hoveredStructureNode={hoveredStructureNode}
          onModelTreeLoaded={onModelTreeLoaded}
          tree={tree}
          onHover={onHover}
          onSelectByClick={onSelectByClick}
        />
      </Canvas>
    </div>
  );
}
