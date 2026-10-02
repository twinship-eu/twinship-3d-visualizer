import { cn } from "@/lib/utils";
import { EVENT_KIND_CHIPS } from "../event-log-config";
import type { LogEvent } from "../event-log-types";

/** An event's severity, as the design's chip. */
export function EventKindChip({ kind }: { kind: LogEvent["kind"] }) {
  const chip = EVENT_KIND_CHIPS[kind];
  return <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", chip.className)}>{chip.label}</span>;
}
