import { cn } from "@/lib/utils";

type Props = {
  /** Oldest first. */
  values: number[];
  /** A Tailwind stroke class: the line's colour. */
  strokeClass: string;
  className?: string;
};

/** Drawn in a 100 × 30 box, stretched to fit: only its shape matters. */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 30;
/** Room kept above and below, so the line's peaks are not clipped. */
const PADDING = 2;

/**
 * A reading's recent trend, as a line scaled to its own range: the shape of
 * the last minute, not its values.
 */
export function Sparkline({ values, strokeClass, className }: Props) {
  if (values.length < 2) return <svg className={className} aria-hidden />;

  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * VIEW_WIDTH;
      const y = PADDING + (1 - (value - low) / range) * (VIEW_HEIGHT - PADDING * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        className={strokeClass}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
