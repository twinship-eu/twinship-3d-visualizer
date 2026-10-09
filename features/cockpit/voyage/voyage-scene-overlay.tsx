"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveData, usePlayback, viewLiveDataAt } from "@/features/live-data/hooks/use-live-data";
import { useZoomControls } from "@/features/3d-scene/components/zoom-controls-overlay";
import { useShipVoyage } from "@/features/3d-scene/components/ship-voyage-context";
import { BridgeControls } from "@/features/bridge/components/bridge-controls";
import { setBridgeActive } from "@/features/bridge/lib/bridge-store";
import { SegmentedControl } from "../components/segmented-control";
import { IS_BRIDGE_VIEW_ENABLED } from "../cockpit-config";
import { liveSceneOverrides } from "@/features/3d-scene/lib/live-scene-overrides";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/features/ship-visualizer/ship-visualizer-config";
import { LIVE_CAMERA_BEARING_DEG, LIVE_CAMERA_POSE, VOYAGE_CAMERA } from "../cockpit-voyage";
import { poseLookingTowards } from "@/features/3d-scene/lib/compass-camera-pose";
import { CompassTape } from "./compass-tape";
import { PlaybackTimeline } from "../components/playback-timeline";
import { AttitudeCard, MotionCard, RelativeWindCard } from "./voyage-instruments";

/** Tailwind's lg: where the replay bar is shown. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** The camera can always be moved by hand: following the ship, or on its bridge. */
type CameraMode = "follow" | "bridge";

/**
 * The Voyage view over the scene: the compass tape, the ship's motion,
 * attitude and relative wind, the route's progress and the camera's modes —
 * or, on the bridge, the glass HUD's controls: the glass carries the rest.
 * Rendered inside the Scene, for the camera and the ship's voyage. The ship
 * is set under way, as the live data reports it.
 */
/**
 * Live data's ship, under way from its data's start: set under way, the
 * camera on the Ontology's view held to its compass bearing, the replay
 * playing from the first moment kept (the log filling row by row). On
 * leaving: back to live, the ship stopped and the camera on the Ontology's
 * own view. Rendered inside the Scene, for the camera and the ship's voyage.
 * The Voyage view's own, and — one Live view — Live data's.
 */
export function LiveUnderWay() {
  const cameraActions = useZoomControls();
  const { setIsTraveling } = useShipVoyage();
  const hasMovedCamera = useRef(false);

  // Under way on entering; once only — the anchor button can still stop it
  useEffect(() => {
    setIsTraveling(true);
  }, [setIsTraveling]);

  // The Ontology's view, the ship turned on it to its heading, as soon as both are known;
  // from then on the camera holds that bearing as the ship turns (SceneCompassCamera)
  const headingDeg = useLiveData()?.navigation.headingDeg;
  const hasHeading = headingDeg !== undefined;
  useEffect(() => {
    if (!cameraActions || !hasHeading || headingDeg === undefined || hasMovedCamera.current) return;
    hasMovedCamera.current = true;
    const pose = poseLookingTowards(LIVE_CAMERA_POSE, LIVE_CAMERA_BEARING_DEG, headingDeg);
    liveSceneOverrides.compassCamera = { bearingDeg: LIVE_CAMERA_BEARING_DEG, headingDeg };
    cameraActions.moveCameraTo(pose.position, pose.target);
    // Only the first heading sets the pose: the camera turns with the later ones itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActions, hasHeading]);
  // Leaving for the Ontology: the camera let go of the compass and back to the Ontology's own view,
  // and the ship stopped — the Ontology shows it at rest. (The latest actions, for the cleanup)
  const latestCameraActions = useRef(cameraActions);
  useEffect(() => {
    latestCameraActions.current = cameraActions;
  }, [cameraActions]);
  useEffect(
    () => () => {
      liveSceneOverrides.compassCamera = null;
      latestCameraActions.current?.moveCameraTo(DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET);
      setIsTraveling(false);
    },
    [setIsTraveling]
  );

  // From the data's first moment, playing on; leaving goes live again
  const { oldest } = usePlayback();
  const hasStartedAtBeginning = useRef(false);
  useEffect(() => {
    if (oldest === null || hasStartedAtBeginning.current) return;
    hasStartedAtBeginning.current = true;
    // Only where the replay bar is, to step and play from: the phone has none, and shows it live
    if (window.matchMedia(DESKTOP_QUERY).matches) viewLiveDataAt(oldest, true);
  }, [oldest]);
  useEffect(() => () => viewLiveDataAt(null), []);
  useEffect(() => () => setBridgeActive(false), []);

  return null;
}

export function VoyageSceneOverlay() {
  const snapshot = useLiveData();
  const cameraActions = useZoomControls();
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");

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
      <LiveUnderWay />
      {isOnBridge ? (
        <BridgeControls />
      ) : (
        <>
          <CompassTape headingDeg={snapshot.navigation.headingDeg} courseDeg={snapshot.navigation.courseOverGroundDeg} />
          <div data-callout-avoid className="absolute top-[64px] left-4">
            <MotionCard snapshot={snapshot} />
          </div>
          <div data-callout-avoid className="absolute top-4 right-4 flex flex-col gap-3">
            <AttitudeCard attitude={snapshot.systems.hull} />
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
            ...(IS_BRIDGE_VIEW_ENABLED ? [{ value: "bridge" as const, label: "Bridge" }] : []),
          ]}
        />
      </div>
    </div>
  );
}
