import { cn } from "@/lib/utils";
import type { TrendLimit } from "./component-live-types";

type Props = {
  /** Each line's values, oldest first, all the same length. */
  lines: { values: number[]; strokeClass: string }[];
  limits?: TrendLimit[];
  className?: string;
};

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 40;
/** A share of the range left free above and below the lines. */
const HEADROOM = 0.15;

const LIMIT_CLASSES: Record<TrendLimit["tone"], string> = {
  warn: "stroke-warn",
  alarm: "stroke-alarm",
  advised: "stroke-ok",
};

/**
 * A minute of one or more readings, on a shared scale that also takes in
 * their limits, drawn dashed: how close the lines run to them. Past the
 * alarm limit the chart is shaded.
 */
export function TrendChart({ lines, limits = [], className }: Props) {
  const values = [...lines.flatMap((line) => line.values), ...limits.map((limit) => limit.value)];
  if (lines.every((line) => line.values.length < 2)) return <svg className={className} aria-hidden />;

  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const bottom = low - span * HEADROOM;
  const top = high + span * HEADROOM;
  const y = (value: number) => ((top - value) / (top - bottom)) * VIEW_HEIGHT;
  const alarm = limits.find((limit) => limit.tone === "alarm");

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {alarm && <rect x={0} y={0} width={VIEW_WIDTH} height={y(alarm.value)} className="fill-alarm-soft" />}
      {limits.map((limit) => (
        <line
          key={`${limit.tone}-${limit.value}`}
          x1={0}
          x2={VIEW_WIDTH}
          y1={y(limit.value)}
          y2={y(limit.value)}
          className={LIMIT_CLASSES[limit.tone]}
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {lines.map(({ values: lineValues, strokeClass }, index) => (
        <polyline
          key={index}
          points={lineValues
            .map((value, step) => `${((step / Math.max(lineValues.length - 1, 1)) * VIEW_WIDTH).toFixed(1)},${y(value).toFixed(1)}`)
            .join(" ")}
          fill="none"
          className={strokeClass}
          strokeWidth={1.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
