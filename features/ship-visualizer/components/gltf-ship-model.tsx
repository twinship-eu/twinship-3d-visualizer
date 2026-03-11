import { useGLTF } from "@react-three/drei";
import { ShipTreeNode } from "../ship-visualizer-types";
import { useEffect, useMemo } from "react";
import { Group } from "three";
import { SHIP_MODEL_SCALE, UNSELECTED_PART_OPACITY } from "../ship-visualizer-config";
import {
  applySelectionOpacity,
  buildTreeFromModel,
  ensureUniqueMaterialsPerMesh,
  setMaterialsDoubleSide,
} from "../lib/3d-model";
import CameraFitToSelection from "./camera-fit-to-section";

export default function GltfShipModel({
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
    setMaterialsDoubleSide(clone);
    ensureUniqueMaterialsPerMesh(clone);
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