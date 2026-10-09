"use client";

import { AssistantHighlights } from "@/features/assistant/components/assistant-highlights";
import { BridgeView } from "@/features/bridge/components/bridge-view";
import { useBridgeState } from "@/features/bridge/lib/bridge-store";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { HighlightProjector } from "@/features/assistant/components/highlight-projector";
import { useEffect, useRef } from "react";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { CalloutAnchorProjector } from "../callouts/callout-anchor-projector";
import type { CalloutDefinition } from "../callouts/callout-config";
import { LiveCallouts } from "../callouts/live-callouts";
import { SelectionSceneHeader } from "../component-live/selection-scene-header";
import { SensorAnchorProjector } from "../component-live/sensor-anchor-projector";
import { SensorOverlay } from "../component-live/sensor-overlay";
import { IS_SINGLE_LIVE_VIEW_ENABLED, type LiveView } from "../cockpit-config";
import { AlarmBadges } from "./alarm-badges";
import { ComponentAlarmGlow } from "./component-alarm-glow";
import { LiveViewControls } from "./live-view-controls";
import { LiveTopInstruments } from "./live-top-instruments";
import { NavigationStrip } from "./navigation-strip";
import { PlaybackTimeline } from "./playback-timeline";

type ProjectorProps = {
  callouts: CalloutDefinition[] | null;
  /** The view the callouts are for: a fresh projector for each. */
  view: LiveView;
  liveSelection: ShipTreeNode | null;
};

/**
 * Inside the Canvas, in Live data: what projects the callouts' and the
 * sensors' parts onto the screen, and the glow on the parts in warning.
 */
export function LiveSceneProjectors({ callouts, view, liveSelection }: ProjectorProps) {
  return (
    <>
      <ComponentAlarmGlow focusedLabel={liveSelection?.label ?? null} />
      <HighlightProjector />
      <BridgeView />
      {callouts && <CalloutAnchorProjector key={view} callouts={callouts} />}
      {/* A fresh projector for each component: it finds its part anew */}
      {liveSelection && <SensorAnchorProjector key={liveSelection.id} componentLabel={liveSelection.label} />}
    </>
  );
}

type OverlayProps = ProjectorProps & {
  /** The section the selected component is part of, for the breadcrumb. */
  sectionLabel?: string;
  isShowingCallouts: boolean;
  isShowingNavigation: boolean;
  onViewChange: (view: LiveView) => void;
  onShowCalloutsChange: (isShowing: boolean) => void;
  onShowNavigationChange: (isShowing: boolean) => void;
  onOpenComponent: (label: string) => void;
  onOverview: () => void;
};

/**
 * Over the scene, in Live data: the view's callouts and controls — or, with
 * a component selected, its breadcrumb, alarm banner and sensors — and a
 * "!" on each part glowing for an alarm.
 */
export function LiveSceneOverlays({
  callouts,
  view,
  liveSelection,
  sectionLabel,
  isShowingCallouts,
  isShowingNavigation,
  onViewChange,
  onShowCalloutsChange,
  onShowNavigationChange,
  onOpenComponent,
  onOverview,
}: OverlayProps) {
  // On the bridge the glass carries the readings: the callouts give way
  const { isActive: isOnBridge, openRequest } = useBridgeState();
  const snapshot = useLiveData();
  // A card clicked on the glass: its component opened, which takes the view off the bridge
  const handledOpen = useRef<number | null>(openRequest?.count ?? null);
  useEffect(() => {
    if (!openRequest || openRequest.count === handledOpen.current) return;
    handledOpen.current = openRequest.count;
    onOpenComponent(openRequest.componentLabel);
  }, [openRequest, onOpenComponent]);
  if (liveSelection) {
    return (
      <>
        <SelectionSceneHeader componentLabel={liveSelection.label} sectionLabel={sectionLabel} onOverview={onOverview} />
        <SensorOverlay key={liveSelection.id} componentLabel={liveSelection.label} />
        <AlarmBadges onOpenComponent={onOpenComponent} />
      </>
    );
  }

  return (
    <>
      <AlarmBadges onOpenComponent={onOpenComponent} />
      <AssistantHighlights onOpenComponent={onOpenComponent} />
      {callouts && !isOnBridge && <LiveCallouts key={view} callouts={callouts} onOpenComponent={onOpenComponent} />}
      <LiveViewControls
        view={view}
        onViewChange={onViewChange}
        isShowingCallouts={isShowingCallouts}
        onShowCalloutsChange={onShowCalloutsChange}
        isShowingNavigation={isShowingNavigation}
        onShowNavigationChange={onShowNavigationChange}
      />
      {IS_SINGLE_LIVE_VIEW_ENABLED ? (
        <>
          {/* The heading and the attitude over the top */}
          {isShowingNavigation && <LiveTopInstruments />}
          {/*
            One compact bar under the ship, right of the zoom controls: the replay, then the wind and the route.
            Its parent spans the room it has, for the readouts to give way by: the bar itself only as wide as they are
          */}
          <div className="@container pointer-events-none absolute right-4 bottom-4 left-[72px] z-20 hidden lg:block">
            <PlaybackTimeline isCompact className="w-fit max-w-full" trailing={isShowingNavigation && snapshot ? <NavigationStrip snapshot={snapshot} /> : null} />
          </div>
        </>
      ) : (
        view === "systems" && <PlaybackTimeline />
      )}
    </>
  );
}
