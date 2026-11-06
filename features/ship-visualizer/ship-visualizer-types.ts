import type { KnowledgeGraph } from "./lib/knowledge-graph";

export type ShipTreeNode = {
  id: string;
  label: string;
  children?: ShipTreeNode[];
  /** When set, selecting this node loads this model in the scene. */
  modelPath?: string;
  /** Three.js object uuid – when set, selection matches by identity instead of name. */
  objectUuid?: string;
};

/** Where a part's knowledge graph came from: the pipeline's GraphDB, or the export bundled with the viewer. */
export type KnowledgeGraphSource = "graphdb" | "bundled";

/** The knowledge graph route's answer. */
export type KnowledgeGraphResponse = { source: KnowledgeGraphSource; graph: KnowledgeGraph };
