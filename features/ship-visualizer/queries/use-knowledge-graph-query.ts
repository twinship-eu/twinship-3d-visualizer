"use client";

import useSWR from "swr";
import { instancesOfPart, KNOWLEDGE_GRAPH } from "../lib/knowledge-graph";
import { KNOWLEDGE_GRAPH_ROUTE } from "../ship-knowledge-graph-config";
import type { KnowledgeGraphResponse, ShipTreeNode } from "../ship-visualizer-types";

async function fetchKnowledgeGraph([url]: [string, string]): Promise<KnowledgeGraphResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`The knowledge graph route answered ${response.status}`);
  return (await response.json()) as KnowledgeGraphResponse;
}

/**
 * The knowledge graph a selected part's screens show, queried when the part
 * is selected — each selection asks again, so what is shown is what the
 * graph holds now. Only for a part the graph has (see `PART_INSTANCES`).
 * Until the answer, and when the route cannot be reached, the bundled export:
 * nothing to show as an error, the screens say where their data came from.
 * The screens of one part share one request.
 */
export function useKnowledgeGraphQuery(node: ShipTreeNode | null) {
  const label = node && instancesOfPart(node.label).length > 0 ? node.label : null;
  const { data, error, isLoading } = useSWR(label ? [KNOWLEDGE_GRAPH_ROUTE, label] : null, fetchKnowledgeGraph, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  return {
    graph: data?.graph ?? KNOWLEDGE_GRAPH,
    source: error ? "bundled" : data?.source,
    isQuerying: isLoading,
  } as const;
}
