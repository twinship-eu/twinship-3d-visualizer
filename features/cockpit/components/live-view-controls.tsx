"use client";

import { Compass, LayoutGrid } from "lucide-react";
import type { LiveView } from "../cockpit-config";
import { SegmentedControl } from "./segmented-control";

type Props = {
  view: LiveView;
  onViewChange: (view: LiveView) => void;
  isShowingCallouts: boolean;
  onShowCalloutsChange: (isShowing: boolean) => void;
};

/** Over the scene's top left, in Live data: Systems or Voyage, and the callouts on or off. */
export function LiveViewControls({ view, onViewChange, isShowingCallouts, onShowCalloutsChange }: Props) {
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-20 hidden gap-3 lg:flex">
      <SegmentedControl
        label="Live view"
        value={view}
        onChange={onViewChange}
        options={[
          { value: "systems", label: "Systems", icon: LayoutGrid },
          { value: "voyage", label: "Voyage", icon: Compass, disabledReason: "The Voyage view comes next" },
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
