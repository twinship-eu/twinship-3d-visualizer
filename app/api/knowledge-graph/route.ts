import { KNOWLEDGE_GRAPH } from "@/features/ship-visualizer/lib/knowledge-graph";
import { cachedGraphDBKnowledgeGraph } from "@/features/ship-visualizer/lib/graphdb-knowledge-graph";
import type { KnowledgeGraphResponse } from "@/features/ship-visualizer/ship-visualizer-types";

/**
 * The futuristic vessel's knowledge graph, as the selected part's screens
 * show it: read from the data pipeline's GraphDB when it is set up (see
 * GRAPHDB_ENV) and kept for a minute (GRAPHDB_FRESH_MS), the bundled export
 * when it is not or does not answer — the screens then carry on with it,
 * saying so.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const graph = await cachedGraphDBKnowledgeGraph();
    if (graph) return Response.json({ source: "graphdb", graph } satisfies KnowledgeGraphResponse, { headers });
  } catch (error) {
    console.warn("Knowledge graph: GraphDB did not answer; the bundled export is shown.", error);
  }
  console.info("[knowledge-graph] Serving the bundled export (GraphDB is not set up or did not answer).");
  return Response.json({ source: "bundled", graph: KNOWLEDGE_GRAPH } satisfies KnowledgeGraphResponse, { headers });
}
