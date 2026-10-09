import { Circle, Ellipsis, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlarmScope } from "@/features/live-data/live-data-types";

const SCOPES: { scope: AlarmScope; label: string; Icon: typeof Ship }[] = [
  { scope: "component", label: "Component", Icon: Circle },
  { scope: "group", label: "Group", Icon: Ellipsis },
  { scope: "ship", label: "Whole ship", Icon: Ship },
];

type Props = {
  scope: AlarmScope;
  /** A sensor past its limit is amber; a behaviour anomaly, orange-red. */
  isBehaviour: boolean;
};

/**
 * Where an alert sits among the three scopes — one component, a group that
 * works together, the whole ship — the one it is, lit: so every alert reads
 * the same way, whatever raised it.
 */
export function AnomalyScope({ scope, isBehaviour }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-muted">ANOMALY SCOPE</h3>
      <div role="list" aria-label="Anomaly scope" className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
        {SCOPES.map(({ scope: option, label, Icon }) => (
          <span
            key={option}
            role="listitem"
            aria-current={option === scope ? "true" : undefined}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px]",
              option === scope ? (isBehaviour ? "bg-anomaly font-semibold text-black" : "bg-warn font-semibold text-black") : "text-muted"
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
