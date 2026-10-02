import type { EventKind } from "./event-log-types";

/** The log's filter tabs, in the design's order: all, then by kind. */
export const EVENT_TABS: { id: "all" | EventKind; label: string; kinds: EventKind[] }[] = [
  { id: "all", label: "All", kinds: ["alarm", "warning", "info", "operator", "cleared", "system"] },
  { id: "warning", label: "Warnings", kinds: ["alarm", "warning"] },
  { id: "info", label: "Info", kinds: ["info"] },
  { id: "operator", label: "Operator", kinds: ["operator"] },
  { id: "cleared", label: "Cleared", kinds: ["cleared"] },
  { id: "system", label: "System", kinds: ["system"] },
];

/** Each kind's chip: its label and colours. */
export const EVENT_KIND_CHIPS: Record<EventKind, { label: string; className: string }> = {
  alarm: { label: "Alarm", className: "bg-alarm-soft text-alarm" },
  warning: { label: "Warning", className: "bg-warn-soft text-warn-ink" },
  info: { label: "Info", className: "bg-accent-soft text-accent-ink" },
  operator: { label: "Operator", className: "bg-system-propeller/15 text-system-propeller" },
  cleared: { label: "Cleared", className: "bg-ok-soft text-ok" },
  system: { label: "System", className: "bg-btn text-ink-2" },
};

/**
 * A reading's share of its warning limit from which the log notes it is
 * approaching it, and the share it must fall back under before it notes it
 * again: noise about the threshold is one note, not many.
 */
export const APPROACH_SHARE = 0.95;
export const APPROACH_REARM_SHARE = 0.9;

/** The log's first number: #1001 for its oldest entry. */
export const FIRST_EVENT_NUMBER = 1001;

/** Minutes of data before an alarm's raising its trend shows. */
export const TREND_LEAD_MINUTES = 5;
