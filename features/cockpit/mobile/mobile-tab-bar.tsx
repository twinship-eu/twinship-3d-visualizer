"use client";

import { Bell, LayoutGrid, Map as MapIcon, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAlarms, useLiveData } from "@/features/live-data/hooks/use-live-data";

/** The phone's four places: the live overview, the ship's ontology, the alarms, the voyage. */
export type MobileTab = "overview" | "ship" | "alarms" | "voyage";

const TABS: { id: MobileTab; label: string; icon: typeof Ship }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "ship", label: "Ship", icon: Ship },
  { id: "alarms", label: "Alarms", icon: Bell },
  { id: "voyage", label: "Voyage", icon: MapIcon },
];

type Props = {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
};

/** Below lg: the tabs along the screen's foot, the alarms' count on theirs. */
export function MobileTabBar({ tab, onChange }: Props) {
  const activeCount = getActiveAlarms(useLiveData()).length;

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onChange(id)}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px]",
            tab === id ? "font-semibold text-accent" : "text-muted"
          )}
        >
          <span className="relative">
            <Icon className="size-6" aria-hidden />
            {id === "alarms" && activeCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex size-[18px] items-center justify-center rounded-full bg-alarm-badge text-[10px] font-bold text-alarm-badge-ink">
                {activeCount}
              </span>
            )}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
