import { useFBX } from "@react-three/drei";
import { ShipTreeNode } from "../ship-visualizer-types";
import { useEffect, useMemo } from "react";
import {
  applySelectionOpacity,
  applyVisibility,
  buildTreeFromModel,
  ensureUniqueMaterialsPerMesh,
} from "../lib/3d-model";
import { Group } from "three";
import {
  HOVERED_PART_OPACITY_WHEN_OTHER_SELECTED,
  SHIP_MODEL_SCALE,
  UNSELECTED_PART_OPACITY,
} from "../ship-visualizer-config";
import CameraFitToSelection from "./camera-fit-to-section";

export default function FbxShipModel({
  path,
  selectedStructureNode,
  hoveredStructureNode,
  hiddenNodeIds,
  onModelTreeLoaded,
}: {
  path: string;
  selectedStructureNode: ShipTreeNode | null;
  hoveredStructureNode: ShipTreeNode | null;
  hiddenNodeIds?: Set<string>;
  onModelTreeLoaded?: (tree: ShipTreeNode[]) => void;
}) {
  const fbx = useFBX(path);
  const cloned = useMemo(() => {
    const clone = fbx.clone(true);
    ensureUniqueMaterialsPerMesh(clone);
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
      <primitive
        object={cloned as Group}
        scale={SHIP_MODEL_SCALE}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}