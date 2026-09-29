import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getObjectDetailsForNode } from "@/features/ship-visualizer/selection-details";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { Sparkline } from "../components/sparkline";
import type { ComponentLiveDefinition } from "./component-live-types";

const SECTION_LABEL_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

/** A bar from 0 to 1, over the design's track. */
export function ProgressBar({ share, barClass }: { share: number; barClass: string }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-track">
      <div className={cn("h-full rounded-full", barClass)} style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%` }} />
    </div>
  );
}

type Props = {
  /** The component, by its label: for its ontology parameters' links. */
  componentLabel: string;
  definition: ComponentLiveDefinition;
  snapshot: LiveSnapshot;
  history: LiveSnapshot[];
};

/** A component's Live tab: its health, its readings now and their minute, its lifecycle. */
export function LiveTab({ componentLabel, definition, snapshot, history }: Props) {
  const { health, readings, lifecycle } = definition;
  // Each ontology property's definition, by its local name (or name), for the readings that measure one
  const ontologyLinks = new Map(
    getObjectDetailsForNode({ id: componentLabel, label: componentLabel }).parameters
      .filter((parameter) => parameter.href)
      .map((parameter) => [parameter.property ?? parameter.name, parameter.href!])
  );

  return (
    <div className="flex flex-col gap-5 px-6 py-5 text-sm">
      <section className="flex items-center gap-5">
        <div className="flex shrink-0 flex-col">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted">HEALTH</span>
          <span className="flex items-baseline">
            <span className="text-[34px] leading-none font-bold">{health.score}</span>
            <span className="font-mono text-muted">/100</span>
          </span>
        </div>
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <ProgressBar share={health.score / 100} barClass="bg-ok" />
          <span className="text-xs text-muted">{health.caption}</span>
        </div>
      </section>

      <section className="flex flex-col">
        <h3 className={cn(SECTION_LABEL_CLASS, "mb-1")}>LIVE READINGS</h3>
        {readings.map((reading) => (
          <div key={reading.label} className="flex flex-col gap-2 border-b border-line py-3 last:border-0">
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 grow items-center gap-1.5 text-ink">
                <span className="truncate">
                  {reading.label}
                  {reading.detail && <span className="text-muted"> · {reading.detail}</span>}
                </span>
                {reading.ontologyParameter && ontologyLinks.has(reading.ontologyParameter) && (
                  <a
                    href={ontologyLinks.get(reading.ontologyParameter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`In the ontology: ${reading.ontologyParameter}`}
                    aria-label={`${reading.ontologyParameter} in the ontology (opens in new tab)`}
                    className="shrink-0 text-accent-ink hover:text-accent"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </span>
              {reading.hasTrend && (
                <Sparkline
                  values={history.map(reading.value)}
                  strokeClass={reading.barClass === "bg-ok" ? "stroke-system-hull" : "stroke-accent"}
                  className="h-5 w-24 shrink-0"
                />
              )}
              <span className="min-w-16 shrink-0 text-right font-mono font-semibold whitespace-nowrap">{reading.format(reading.value(snapshot))}</span>
            </div>
            {reading.bar && <ProgressBar share={reading.bar(snapshot)} barClass={reading.barClass ?? "bg-accent"} />}
          </div>
        ))}
      </section>

      {lifecycle.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className={SECTION_LABEL_CLASS}>LIFECYCLE PROGRESS</h3>
          {lifecycle.map((row) => (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <span className="text-ink">{row.label}</span>
                <span className="font-mono font-semibold">
                  {row.pct}%{row.note && ` · ${row.note}`}
                </span>
              </div>
              <ProgressBar share={row.pct / 100} barClass={row.barClass} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
