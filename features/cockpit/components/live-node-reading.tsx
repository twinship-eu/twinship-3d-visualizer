"use client";

import { cn } from "@/lib/utils";
import { getActiveAlarms, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { componentReading, type ReadingTone } from "../lib/component-readings";

const TONE_CLASSES: Record<ReadingTone, string> = {
  value: "font-mono text-muted",
  ok: "text-ok",
  warn: "font-semibold text-warn",
};

/**
 * A tree row's live reading, beside its label. Reads the live data itself,
 * so only the reading re-renders every second, not the tree.
 */
export function LiveNodeReading({ label }: { label: string }) {
  const snapshot = useLiveData();
  if (!snapshot) return null;

  const hasActiveAlarm = getActiveAlarms(snapshot).some((alarm) => alarm.componentLabel === label);
  const reading = componentReading(label, snapshot, hasActiveAlarm);
  if (!reading) return null;

  return (
    <span className={cn("shrink-0 text-[11px] tabular-nums", TONE_CLASSES[reading.tone])}>{reading.text}</span>
  );
}
