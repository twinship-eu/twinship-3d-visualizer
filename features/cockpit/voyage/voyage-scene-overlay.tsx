"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { useZoomControls } from "@/features/3d-scene/components/zoom-controls-overlay";
import { useShipVoyage } from "@/features/3d-scene/components/ship-voyage-context";
import { BridgeControls } from "@/features/bridge/components/bridge-controls";
import { setBridgeActive } from "@/features/bridge/lib/bridge-store";
import { SegmentedControl } from "../components/segmented-control";
import { VOYAGE_CAMERA } from "../cockpit-voyage";
import { CompassTape } from "./compass-tape";
import { RouteProgress } from "./route-progress";
import { AttitudeCard, MotionCard, RelativeWindCard } from "./voyage-instruments";

type CameraMode = "follow" | "free" | "topDown" | "bridge";

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

  const chooseCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    setBridgeActive(mode === "bridge");
    if (mode === "follow") cameraActions?.moveCameraTo(VOYAGE_CAMERA.follow.position, VOYAGE_CAMERA.follow.target);
    if (mode === "topDown") cameraActions?.moveCameraTo(VOYAGE_CAMERA.topDown.position, VOYAGE_CAMERA.topDown.target);
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
          {/* Clear of the zoom controls in the scene's bottom right corner */}
          <div data-callout-avoid className="absolute right-[68px] bottom-4">
            <RouteProgress snapshot={snapshot} />
          </div>
        </>
      )}
      <div data-callout-avoid className="absolute bottom-4 left-4">
        <SegmentedControl
          label="Camera"
          value={cameraMode}
          onChange={chooseCameraMode}
          options={[
            { value: "follow", label: "Follow ship" },
            { value: "free", label: "Free camera" },
            { value: "topDown", label: "Top down" },
            { value: "bridge", label: "Bridge" },
          ]}
        />
      </div>
    </div>
  );
}
