"use client";

import { cn } from "@/lib/utils";
import { useBridgeState } from "@/features/bridge/lib/bridge-store";
import { CONTROL_ROOM_LABEL } from "@/features/bridge/bridge-config";
import { getActiveAlarms, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { componentReading, voyageSectionReading, type ReadingTone } from "../lib/component-readings";

const TONE_CLASSES: Record<ReadingTone, string> = {
  value: "font-mono text-muted",
  ok: "text-ok",
  warn: "font-semibold text-warn",
};

/**
 * A tree row's live reading, beside its label. Reads the live data itself,
 * so only the reading re-renders every second, not the tree.
 */
export function LiveNodeReading({ label, isVoyage = false }: { label: string; isVoyage?: boolean }) {
  const snapshot = useLiveData();
  const { isActive: isOnBridge } = useBridgeState();
  // Where the camera stands, on the bridge
  if (isOnBridge && label === CONTROL_ROOM_LABEL) return <span className="shrink-0 text-[11px] text-accent-ink">you are here</span>;
  if (!snapshot) return null;

  const hasActiveAlarm = getActiveAlarms(snapshot).some((alarm) => alarm.componentLabel === label);
  // In Voyage, a section reads as the voyage sees it; its components as in Systems
  const reading =
    (isVoyage ? voyageSectionReading(label, snapshot) : null) ?? componentReading(label, snapshot, hasActiveAlarm);
  if (!reading) return null;

  return (
    <span className={cn("shrink-0 text-[11px] tabular-nums", TONE_CLASSES[reading.tone])}>{reading.text}</span>
  );
}
