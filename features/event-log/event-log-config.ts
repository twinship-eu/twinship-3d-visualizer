import type { EventKind } from "./event-log-types";

/** The log's filter tabs, in the design's order: all, then by kind. */
export const EVENT_TABS: { id: "all" | EventKind; label: string; kinds: EventKind[] }[] = [
  { id: "all", label: "All", kinds: ["alarm", "warning", "anomaly", "info", "operator", "cleared", "system"] },
  { id: "warning", label: "Warnings", kinds: ["alarm", "warning"] },
  { id: "anomaly", label: "Anomalies", kinds: ["anomaly"] },
  { id: "info", label: "Info", kinds: ["info"] },
  { id: "operator", label: "Operator", kinds: ["operator"] },
  { id: "cleared", label: "Cleared", kinds: ["cleared"] },
  { id: "system", label: "System", kinds: ["system"] },
];

/** Each kind's chip: its label and colours. */
export const EVENT_KIND_CHIPS: Record<EventKind, { label: string; className: string }> = {
  alarm: { label: "Alarm", className: "bg-alarm-soft text-alarm" },
  warning: { label: "Warning", className: "bg-warn-soft text-warn-ink" },
  anomaly: { label: "Anomaly", className: "bg-anomaly-soft text-anomaly-ink" },
  info: { label: "Info", className: "bg-accent-soft text-accent-ink" },
  operator: { label: "Operator", className: "bg-system-propeller/15 text-system-propeller" },
  cleared: { label: "Cleared", className: "bg-ok-soft text-ok" },
  system: { label: "System", className: "bg-btn text-ink-2" },
};

/** The log's first number: #1001 for its oldest entry. */
export const FIRST_EVENT_NUMBER = 1001;

/** Minutes of data before an alarm's raising its trend shows. */
export const TREND_LEAD_MINUTES = 5;

/**
 * One log row per row of the recording: the workbook's step, in seconds. The
 * log lists every row; Warnings, only those with a reading past its limit.
 */
export const RECORDING_ROW_SECONDS = 5;

/** Whether the readings' time series is offered: from a log event (over the scene), and under the scene for a selected component. */
export const IS_TIME_SERIES_DRAWER_ENABLED = true;
