"use client";

import { getSectionIdOf } from "@/features/ship-visualizer/lib/section-colors";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { SHIP_TREE_SECTIONS } from "@/features/ship-visualizer/ship-visualizer-config";
import type { LogEvent } from "../event-log-types";
import { useEventLog } from "../hooks/use-event-log";

/** A tree row's count of events: a section's, all its components'; a component's, its own. */
export function eventCountOf(node: ShipTreeNode, events: LogEvent[]) {
  const isSection = SHIP_TREE_SECTIONS.some((section) => section.id === node.id);
  return events.filter((event) => {
    if (!event.componentLabel) return false;
    if (!isSection) return event.componentLabel === node.label;
    return getSectionIdOf({ id: event.componentLabel, label: event.componentLabel }) === node.id;
  }).length;
}

/** A tree row's count, beside its label: bright when it is the log's filter. */
export function EventCount({ count, isFilter }: { count: number; isFilter: boolean }) {
  if (count === 0) return null;
  return <span className={isFilter ? "font-mono text-[12px] font-bold text-accent-ink" : "font-mono text-[12px] text-muted"}>{count}</span>;
}

/** Under the tree while the log is open: what its counts are, and the way back. */
export function EventsPerSystemNote({ onBack }: { onBack: () => void }) {
  return (
    <section className="m-3.5 flex flex-col gap-2 rounded-[10px] border border-line bg-card px-4 py-3.5 text-[13px]">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted">EVENTS PER SYSTEM</h2>
      <p className="text-ink-2">The counts in the tree are the log&apos;s events. Click a system to filter the log to it and its components.</p>
      <button type="button" onClick={onBack} className="cursor-pointer self-start font-semibold text-accent-ink hover:text-accent">
        ← Back to the ship
      </button>
    </section>
  );
}

/** A tree row's live count of events: reads the log itself, so only the count re-renders. */
export function LogNodeCount({ node, filterId }: { node: ShipTreeNode; filterId: string | null }) {
  const { events } = useEventLog();
  return <EventCount count={eventCountOf(node, events)} isFilter={filterId === node.id} />;
}
