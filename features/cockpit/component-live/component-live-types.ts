import type { LiveSnapshot } from "@/features/live-data/live-data-types";

/** A reading from the snapshot. */
export type Reader = (snapshot: LiveSnapshot) => number;

/** A row of the Live tab's readings: its value, and a bar and a trend if it has them. */
export type LiveReadingRow = {
  label: string;
  /** After the label, muted: e.g. its design value. */
  detail?: string;
  value: Reader;
  format: (value: number) => string;
  /** How full its bar is, 0 to 1; no bar without it. */
  bar?: Reader;
  /** The bar's colour, a Tailwind class. */
  barClass?: string;
  /** Whether it shows its last minute beside the value. */
  hasTrend?: boolean;
  /** The ontology parameter it measures, by name: linked to its definition. */
  ontologyParameter?: string;
};

/** A row of the lifecycle bars: how far through, and a note after the share. */
export type LifecycleRow = { label: string; pct: number; note?: string; barClass: string };

/** A line of a trend chart. */
export type TrendSeries = { label: string; value: Reader; strokeClass: string };

/** A limit drawn across a trend chart, dashed: a warning's or an alarm's. */
export type TrendLimit = { value: number; tone: "warn" | "alarm" | "advised" };

/** A card of trends under the scene: its title, its value now, its lines. */
export type TrendCard = {
  title: string;
  /** The series' names after the title, coloured as their lines. */
  series: TrendSeries[];
  /** Its value now, top right. */
  format: (values: number[]) => string;
  limits?: TrendLimit[];
  /** A note in the title, e.g. "advised 9 kn", in the ok colour. */
  note?: string;
};

/** What a component's live panel shows. */
export type ComponentLiveDefinition = {
  health: { score: number; caption: string };
  readings: LiveReadingRow[];
  lifecycle: LifecycleRow[];
  trends: TrendCard[];
};
