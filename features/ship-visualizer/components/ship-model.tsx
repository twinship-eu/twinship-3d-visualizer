import { FBX_EXT } from "../lib/constants";
import { ShipTreeNode } from "../ship-visualizer-types";
import FbxShipModel from "./fbx-ship-model";
import GltfShipModel from "./gltf-ship-model";

export default function ShipModel({
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