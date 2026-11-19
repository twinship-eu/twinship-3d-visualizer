import { cn } from "@/lib/utils";
import type { KnowledgeGraphSource as Source } from "../ship-visualizer-types";

type Props = { source?: Source; isQuerying: boolean; className?: string };

/** What the knowledge graph shown came from: a query of GraphDB, or the export bundled with the viewer. */
export function knowledgeGraphSourceText({ source, isQuerying }: Pick<Props, "source" | "isQuerying">) {
  if (isQuerying) return "querying the knowledge graph…";
  return source === "graphdb" ? "queried from GraphDB" : "from the bundled knowledge graph export";
}

export function KnowledgeGraphSource({ className, ...props }: Props) {
  return (
    <span className={cn("text-[11px] text-muted", props.isQuerying && "animate-pulse", className)} role="status">
      {knowledgeGraphSourceText(props)}
    </span>
  );
}
