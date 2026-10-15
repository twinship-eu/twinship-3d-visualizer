"use client";

import { Check, Compass, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_NAVIGATION_TOGGLE_ENABLED, IS_SINGLE_LIVE_VIEW_ENABLED, type LiveView } from "../cockpit-config";
import { SegmentedControl } from "./segmented-control";

type Props = {
  view: LiveView;
  isShowingNavigation: boolean;
  onShowNavigationChange: (isShowing: boolean) => void;
  onViewChange: (view: LiveView) => void;
  isShowingCallouts: boolean;
  onShowCalloutsChange: (isShowing: boolean) => void;
};

/** Over the scene's top left, in Live data: its layers — components, navigation — or, split, Systems or Voyage and the callouts. */
/** A layer's toggle: a box ticked while it shows. */
function LayerToggle({ label, isOn, onChange }: { label: string; isOn: boolean; onChange: (isOn: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!isOn)}
      aria-pressed={isOn}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold",
        isOn ? "bg-seg-on text-ink" : "text-ink-2 hover:text-ink"
      )}
    >
      <span className={cn("flex size-3.5 items-center justify-center rounded-[3px] border", isOn ? "border-accent bg-accent" : "border-line-strong")} aria-hidden>
        {isOn && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

export function LiveViewControls({ view, onViewChange, isShowingCallouts, onShowCalloutsChange, isShowingNavigation, onShowNavigationChange }: Props) {
  // One Live view: what it shows, as two layers
  if (IS_SINGLE_LIVE_VIEW_ENABLED) {
    return (
      <div
        data-callout-avoid
        className="pointer-events-auto absolute top-4 left-4 z-20 hidden items-center gap-1 rounded-lg border border-glass-line bg-glass p-1 backdrop-blur lg:flex"
      >
        <span className="px-2 text-[11px] font-semibold tracking-[0.12em] text-muted">SHOW</span>
        <LayerToggle label="Components" isOn={isShowingCallouts} onChange={onShowCalloutsChange} />
        {IS_NAVIGATION_TOGGLE_ENABLED && <LayerToggle label="Navigation" isOn={isShowingNavigation} onChange={onShowNavigationChange} />}
      </div>
    );
  }

  return (
    <div data-callout-avoid className="pointer-events-none absolute top-4 left-4 z-20 hidden gap-3 lg:flex">
      <SegmentedControl
        label="Live view"
        value={view}
        onChange={onViewChange}
        options={[
          { value: "systems", label: "Systems", icon: LayoutGrid },
          { value: "voyage", label: "Voyage", icon: Compass },
        ]}
      />
      {view === "systems" && (
        <SegmentedControl
          label="Callouts"
          value={isShowingCallouts ? "callouts" : "clean"}
          onChange={(option) => onShowCalloutsChange(option === "callouts")}
          options={[
            { value: "callouts", label: "Callouts" },
            { value: "clean", label: "Clean" },
          ]}
        />
      )}
    </div>
  );
}
