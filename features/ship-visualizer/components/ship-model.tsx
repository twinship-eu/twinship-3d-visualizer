import { FBX_EXT } from "../lib/constants";
import { ShipTreeNode } from "../ship-visualizer-types";
import FbxShipModel from "./fbx-ship-model";
import GltfShipModel from "./gltf-ship-model";

export default function ShipModel({
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
  const isFbx = path.toLowerCase().endsWith(FBX_EXT);
  return isFbx ? (
    <FbxShipModel
      path={path}
      selectedStructureNode={selectedStructureNode}
      hoveredStructureNode={hoveredStructureNode}
      hiddenNodeIds={hiddenNodeIds}
      onModelTreeLoaded={onModelTreeLoaded}
    />
  ) : (
    <GltfShipModel
      path={path}
      selectedStructureNode={selectedStructureNode}
      hoveredStructureNode={hoveredStructureNode}
      hiddenNodeIds={hiddenNodeIds}
      onModelTreeLoaded={onModelTreeLoaded}
    />
  );
}