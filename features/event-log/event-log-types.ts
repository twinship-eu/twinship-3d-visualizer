/** What kind of entry of the event log: its severity chip and its filter tab. */
export type EventKind = "alarm" | "warning" | "anomaly" | "info" | "operator" | "cleared" | "system";

/**
 * An entry of the event log: something the ship's data or its operator did,
 * at a moment — derived from the live data (see `buildEventLog`), not kept
 * apart from it.
 */
export type LogEvent = {
  id: string;
  /** Its number in the log, oldest lowest: #1045. */
  number: number;
  /** When, ms since the epoch. */
  at: number;
  kind: EventKind;
  /** The component it concerns, by its label in the tree; null for the data stream itself. */
  componentLabel: string | null;
  /** What on the component: a sensor, a cylinder… */
  subject?: string;
  title: string;
  /** Its reading then, formatted with its unit. */
  value?: string;
  /** Where it stands: Active · unack, Acknowledged, Cleared after 6 m 12 s… */
  status: string;
  /** Whether it still needs the operator: highlighted. */
  isAttention?: boolean;
  /** The alarm it is about, and the sensor whose reading raised it. */
  alarmId?: string;
  sensorId?: string;
  /** A row of the recording: every reading in it, each with its state against its limits. */
  readings?: RowReading[];
};

/** One reading of a recorded row, as the log shows it. */
export type RowReading = { id: string; label: string; value: string; state: "normal" | "warning" | "alarm" };

/** A step of an alarm's life: raised, at its peak, acknowledged, cleared — each when, if it has happened. */
export type LifecycleStep = { label: string; at: number | null; value?: string };
