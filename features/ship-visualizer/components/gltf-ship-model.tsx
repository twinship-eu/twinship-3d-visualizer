import { useGLTF } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { ShipTreeNode } from "../ship-visualizer-types";
import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { getMaxTextureAnisotropy } from "@/features/3d-scene/lib/webgpu-renderer";
import { ASSEMBLY_POINT_COUNT } from "@/features/3d-scene/lib/loading-ring-particles";
import { sampleModelSurfacePoints } from "../lib/sample-model-points";
import {
  HOVERED_PART_OPACITY_WHEN_OTHER_SELECTED,
  PROPELLERS_OBJECT_NAME,
  SHIP_MODEL_SCALE,
  UNSELECTED_PART_OPACITY,
} from "../ship-visualizer-config";
import {
  applySelectionOpacity,
  applyTextureAnisotropy,
  applyVisibility,
  buildTreeFromModel,
  enableModelShadows,
  ensureUniqueMaterialsPerMesh,
} from "../lib/3d-model";
import { splitPropellersIntoSpinners } from "../lib/propellers";
import { SHIP_MATERIAL_TUNING } from "@/features/3d-scene/lib/scene-material-tuning";
import { Mesh, MeshStandardMaterial } from "three";
import CameraFitToSelection from "./camera-fit-to-section";
import SpinningPropellers from "./spinning-propellers";

export default function GltfShipModel({
  path,
  selectedStructureNode,
  hoveredStructureNode,
  hiddenNodeIds,
  onModelTreeLoaded,
  onAssemblyPointsSampled,
}: {
  path: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  hiddenNodeIds?: Set<string>;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
  onAssemblyPointsSampled?: (points: Float32Array) => void;
}) {
  const gltf = useGLTF(path);
  const maxAnisotropy = useThree((state) =>
    getMaxTextureAnisotropy(state.gl)
  );

  const { cloned, propellerSpinners } = useMemo(() => {
    const clone = gltf.scene.clone();
    const spinners = splitPropellersIntoSpinners(clone, PROPELLERS_OBJECT_NAME);
    ensureUniqueMaterialsPerMesh(clone);
    applyTextureAnisotropy(clone, maxAnisotropy);
    enableModelShadows(clone);
    return { cloned: clone, propellerSpinners: spinners };
  }, [gltf.scene, maxAnisotropy]);

  useEffect(() => {
    if (cloned && onModelTreeLoaded) {
      onModelTreeLoaded(buildTreeFromModel(cloned));
    }
  }, [cloned, onModelTreeLoaded]);

  // Sampled here because this is where the built model lives, and the points
  // are wanted the moment it becomes available. World space, so the loading
  // ring can fly particles onto the hull without a space conversion per frame.
  // Applies in production too, not only under the Inspector: the scale is a
  // real material default, and the panel merely tunes it live.
  //
  // Metalness is captured once, so the scale stays relative to what the model
  // actually ships with rather than compounding each frame. The change guard
  // means this costs one traversal, then nothing.
  const baseMetalnessRef = useRef(new Map<string, number>());
  const lastScaleRef = useRef(-1);

  useFrame(() => {
    if (!cloned) return;
    const scale = SHIP_MATERIAL_TUNING.metalnessScale;
    if (scale === lastScaleRef.current) return;
    lastScaleRef.current = scale;

    cloned.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        const base = baseMetalnessRef.current.get(material.uuid);
        const authored = base ?? material.metalness;
        if (base === undefined) {
          baseMetalnessRef.current.set(material.uuid, authored);
        }
        material.metalness = authored * scale;
      }
    });
  });

  useEffect(() => {
    if (!cloned || !onAssemblyPointsSampled) return;
    const points = sampleModelSurfacePoints(cloned, ASSEMBLY_POINT_COUNT);
    if (points !== null) onAssemblyPointsSampled(points);
  }, [cloned, onAssemblyPointsSampled]);

  useEffect(() => {
    if (!cloned) return;
    applySelectionOpacity(
      cloned,
      selectedStructureNode,
      hoveredStructureNode,
      UNSELECTED_PART_OPACITY,
      HOVERED_PART_OPACITY_WHEN_OTHER_SELECTED
    );
  }, [cloned, selectedStructureNode, hoveredStructureNode]);

  useEffect(() => {
    if (!cloned) return;
    applyVisibility(cloned, hiddenNodeIds ?? new Set());
  }, [cloned, hiddenNodeIds]);

  return (
    <>
      <CameraFitToSelection root={cloned} selectedNode={selectedStructureNode} />
      <SpinningPropellers spinners={propellerSpinners} />
      <primitive
        object={cloned as Group}
        scale={SHIP_MODEL_SCALE}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}