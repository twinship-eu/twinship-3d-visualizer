"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveData, usePlayback, viewLiveDataAt } from "@/features/live-data/hooks/use-live-data";
import { useZoomControls } from "@/features/3d-scene/components/zoom-controls-overlay";
import { useShipVoyage } from "@/features/3d-scene/components/ship-voyage-context";
import { BridgeControls } from "@/features/bridge/components/bridge-controls";
import { setBridgeActive } from "@/features/bridge/lib/bridge-store";
import { SegmentedControl } from "../components/segmented-control";
import { VOYAGE_CAMERA } from "../cockpit-voyage";
import { CompassTape } from "./compass-tape";
import { PlaybackTimeline } from "../components/playback-timeline";
import { AttitudeCard, MotionCard, RelativeWindCard } from "./voyage-instruments";

/** The camera can always be moved by hand: following the ship, or on its bridge. */
type CameraMode = "follow" | "bridge";

/**
 * The Voyage view over the scene: the compass tape, the ship's motion,
 * attitude and relative wind, the route's progress and the camera's modes —
 * or, on the bridge, the glass HUD's controls: the glass carries the rest.
 * Rendered inside the Scene, for the camera and the ship's voyage. The ship
 * is set under way, as the live data reports it.
 */
export function VoyageSceneOverlay() {
  const snapshot = useLiveData();
  const cameraActions = useZoomControls();
  const { setIsTraveling } = useShipVoyage();
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const hasMovedCamera = useRef(false);

  // The ship makes way in the Voyage view: set under way on entering it.
  // Once only — the anchor button can still stop it
  useEffect(() => {
    setIsTraveling(true);
  }, [setIsTraveling]);

  // Opens on the design's view from astern, as soon as the camera can be moved
  useEffect(() => {
    if (!cameraActions || hasMovedCamera.current) return;
    hasMovedCamera.current = true;
    cameraActions.moveCameraTo(VOYAGE_CAMERA.follow.position, VOYAGE_CAMERA.follow.target);
  }, [cameraActions]);

  // Off the bridge when the Voyage view closes
  useEffect(() => () => setBridgeActive(false), []);

  // The voyage told from its start: the data's first moment, playing on from it — the log filling row by
  // row — to pause or step on.
  // Once, as soon as the data is there; leaving the view goes live again
  const { oldest } = usePlayback();
  const hasStartedAtBeginning = useRef(false);
  useEffect(() => {
    if (oldest === null || hasStartedAtBeginning.current) return;
    hasStartedAtBeginning.current = true;
    viewLiveDataAt(oldest, true);
  }, [oldest]);
  useEffect(() => () => viewLiveDataAt(null), []);

  const chooseCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    setBridgeActive(mode === "bridge");
    if (mode === "follow") cameraActions?.moveCameraTo(VOYAGE_CAMERA.follow.position, VOYAGE_CAMERA.follow.target);
  };

  if (!snapshot) return null;
  // On the bridge the glass carries the instruments: only the camera's controls stay
  const isOnBridge = cameraMode === "bridge";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
      {isOnBridge ? (
        <BridgeControls />
      ) : (
        <>
          <CompassTape headingDeg={snapshot.navigation.headingDeg} courseDeg={snapshot.navigation.courseOverGroundDeg} />
          <div data-callout-avoid className="absolute top-[64px] left-4">
            <MotionCard snapshot={snapshot} />
          </div>
          <div data-callout-avoid className="absolute top-4 right-4 flex flex-col gap-3">
            <AttitudeCard snapshot={snapshot} />
            <RelativeWindCard snapshot={snapshot} />
          </div>
          {/* The route and the replay in one compact bar, in the scene's bottom right corner */}
          <PlaybackTimeline showsRoute className="absolute right-4 bottom-4 w-[540px]" />
        </>
      )}
      <div data-callout-avoid className="absolute bottom-4 left-[72px]">
        <SegmentedControl
          label="Camera"
          value={cameraMode}
          onChange={chooseCameraMode}
          options={[
            { value: "follow", label: "Follow ship" },
            { value: "bridge", label: "Bridge" },
          ]}
        />
      </div>
    </div>
  );
}
