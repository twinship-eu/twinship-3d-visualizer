export type ShipTreeNode = {
  id: string;
  label: string;
  children?: ShipTreeNode[];
  /** When set, selecting this node loads this model in the scene. */
  modelPath?: string;
  /** Three.js object uuid – when set, selection matches by identity instead of name. */
  objectUuid?: string;
};
