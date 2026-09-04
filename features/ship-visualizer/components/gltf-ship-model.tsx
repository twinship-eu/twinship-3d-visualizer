import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ShipTreeNode } from "../ship-visualizer-types";
import { useEffect, useMemo } from "react";
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
  ensureUniqueMaterialsPerMesh,
} from "../lib/3d-model";
import { splitPropellersIntoSpinners } from "../lib/propellers";
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