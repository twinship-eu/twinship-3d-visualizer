"use client";

import { TriangleAlert } from "lucide-react";
import { getActiveAlarms, useLiveData } from "@/features/live-data/hooks/use-live-data";
import type { Alarm } from "@/features/live-data/live-data-types";

type Props = {
  /** Opens the warning in Live data. */
  onOpen: (alarm: Alarm) => void;
};

/**
 * Under the ontology tree: the live warnings raised while the static model
 * is being browsed, and the way to them. Nothing while there are none.
 */
export function LiveWarningCard({ onOpen }: Props) {
  const activeAlarms = getActiveAlarms(useLiveData());
  const first = activeAlarms[0];
  if (!first) return null;

  const count = activeAlarms.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(first)}
      className="m-3.5 flex w-[calc(100%-1.75rem)] cursor-pointer gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3 py-2.5 text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <TriangleAlert className="mt-px size-4 shrink-0 text-warn" aria-hidden />
      <span className="flex flex-col gap-0.5 text-xs leading-[1.3]">
        <span className="font-semibold text-warn-ink">
          {count} live warning{count === 1 ? "" : "s"} while you browse
        </span>
        <span className="text-ink-2">{first.componentLabel} · open in Live data →</span>
      </span>
    </button>
  );
}
