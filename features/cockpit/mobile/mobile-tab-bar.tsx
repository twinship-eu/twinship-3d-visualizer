"use client";

import { LayoutGrid, List, MessageCircle, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveAlarms, getActiveAnomalies, useLiveData } from "@/features/live-data/hooks/use-live-data";

/** The phone's four places, as the design has them: the live view, the components, the event log, the assistant. */
export type MobileTab = "live" | "components" | "log" | "ask";

const TABS: { id: MobileTab; label: string; icon: typeof Ship }[] = [
  { id: "live", label: "Live", icon: LayoutGrid },
  { id: "components", label: "Components", icon: Ship },
  { id: "log", label: "Log", icon: List },
  { id: "ask", label: "Ask", icon: MessageCircle },
];

type Props = {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
};

/** Below lg: the tabs along the screen's foot, the active warnings' count on the log's. */
export function MobileTabBar({ tab, onChange }: Props) {
  const snapshot = useLiveData();
  const activeCount = getActiveAlarms(snapshot).length + getActiveAnomalies(snapshot).length;

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
            {id === "log" && activeCount > 0 && (
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
