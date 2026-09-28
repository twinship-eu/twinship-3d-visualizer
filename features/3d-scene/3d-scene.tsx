"use client";

import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { Vector3 } from "three/webgpu";
import {
  DEFAULT_CAMERA_POSITION,
} from "../ship-visualizer/ship-visualizer-config";
import {  OrbitControls } from "@react-three/drei";
import {
  IS_RENDERER_BADGE_ENABLED,
  IS_SCENE_STATS_ENABLED,
  SCENE_BACKGROUND_COLOR,
} from "./lib/3d-scene-config";
import { SceneLights } from "./components/scene-lights";
import { SceneSky } from "./components/scene-sky";
import { SceneEnvironmentMap } from "./components/scene-environment-map";
// Water replaced by the raymarched seascape on this branch. Kept, not deleted.
// import { SceneWater } from "./components/scene-water";
import { SceneSeascape } from "./components/scene-seascape";
import { SceneSeascapeSurface } from "./components/scene-seascape-surface";
import { SceneSeascapeAtmosphere } from "./components/scene-seascape-atmosphere";
import { IS_SEASCAPE_SURFACE_ENABLED } from "./lib/seascape-config";
import { canRenderShadows, createSceneRenderer } from "./lib/webgpu-renderer";
import {
  installConsoleCapture,
  useIsDiagnosticsEnabled,
} from "./lib/scene-diagnostics";
import { SceneDiagnosticsProbe } from "./components/scene-diagnostics-probe";
import { SceneDiagnosticsOverlay } from "./components/scene-diagnostics-overlay";

// Installed at module scope so the wrap is in place before the Canvas mounts
// and three starts reporting; an effect would run too late to catch the first
// errors, which are the ones that explain the rest. Inert without `?diag`.
installConsoleCapture();
import { RendererBackendProbe } from "./components/renderer-backend-probe";
import { RendererBackendBadge } from "./components/renderer-backend-badge";
import { SceneStatsProbe } from "./components/scene-stats-probe";
import { SceneStatsOverlay } from "./components/scene-stats-overlay";
import {  useState } from "react";
import { SceneInteractionProvider } from "./components/scene-interaction-context";
import { StageControlHints } from "./components/stage-control-hints";
import {
  ZoomControlsBridge,
  ZoomControlsOverlay,
  ZoomControlsProvider,
} from "./components/zoom-controls-overlay";
import { CameraMotionProvider } from "./components/camera-motion-context";
import { ShipVoyageProvider } from "./components/ship-voyage-context";
import { SceneCameraFollow } from "./components/scene-camera-follow";
import { SceneRenderPipeline } from "./components/scene-render-pipeline";
import { SceneWeather } from "./components/scene-weather";
import { SceneAdaptiveResolution } from "./components/scene-adaptive-resolution";
import { getPerformanceProfile } from "./lib/performance-profile";

/** The camera's far plane, in world units: beyond where the sea's haze is complete. */
const CAMERA_FAR = 2000;


type Props = {
  className?: string;
  children: React.ReactNode;
  /**
   * Whether the details sheet is covering the bottom of the scene. Below lg it
   * hides the hint bar, which would otherwise sit behind the sheet.
   */
  isDetailsOpen?: boolean;
  /** Scale for grid/fog (e.g. from model bounds); default 1. */
  sceneScale?: number;
};



export function Scene({
  className,
  children,
  isDetailsOpen = false,
}: Props) {
  return (
    <div
      className={cn("relative", className ?? "h-full min-h-0 w-full")}
      style={{ backgroundColor: SCENE_BACKGROUND_COLOR }}
    >
      <SceneWithInteraction>{children}</SceneWithInteraction>
      <StageControlHints isDetailsOpen={isDetailsOpen} />
    </div>
  );
}

function SceneWithInteraction({ children }: { children: React.ReactNode }) {
  const [isOrbitControlsActive, setIsOrbitControlsActive] = useState(false);
  const [isWebGPU, setIsWebGPU] = useState<boolean | null>(null);
  // Deliberately false until mounted: branching on the query string during the
  // first render makes the client's tree differ from the server's, which React
  // reports as hydration failure #418.
  const isDiagnosticsOn = useIsDiagnosticsEnabled();

  return (
    <SceneInteractionProvider value={{ isOrbitControlsActive }}>
      <CameraMotionProvider>
      <ShipVoyageProvider>
      <ZoomControlsProvider>
        <Canvas
          // False on Android, where three's own shadow path emits invalid
          // shaders under WebGPU. See canRenderShadows.
          shadows={canRenderShadows()}
          camera={{
            position: new Vector3(...DEFAULT_CAMERA_POSITION),
            fov: 45,
            // Past the sea's haze (1550): at R3F's default 1000 the far sea was cut off
            far: CAMERA_FAR,
          }}
          gl={createSceneRenderer}
          // At most 2 device pixels per CSS pixel, 1.25 on a phone — whose
          // 3 filled the sea's shader, bloom and FXAA with over 6x the pixels;
          // lowered further while the frame rate cannot keep up (SceneAdaptiveResolution)
          dpr={[1, getPerformanceProfile().maxPixelRatio]}
        >
          <RendererBackendProbe onResolved={setIsWebGPU} />
          {IS_SCENE_STATS_ENABLED && <SceneStatsProbe />}
          {isDiagnosticsOn && <SceneDiagnosticsProbe />}
          {/*
            With the surface sea, the sky comes from SceneSeascapeAtmosphere:
            the same sky the water reflects, so sea and sky meet without a seam.
            SkyMesh stays for the raymarched background. (The ship's lighting
            probe bakes its own sky and does not depend on this one.)
          */}
          {!IS_SEASCAPE_SURFACE_ENABLED && <SceneSky />}
          {IS_SEASCAPE_SURFACE_ENABLED && <SceneSeascapeAtmosphere />}
          <SceneEnvironmentMap />
          {/* <SceneWater /> */}
          {IS_SEASCAPE_SURFACE_ENABLED ? <SceneSeascapeSurface /> : <SceneSeascape />}
          <SceneLights />
          {IS_SEASCAPE_SURFACE_ENABLED && <SceneWeather />}
          {children}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={400}
            // Nearly straight up from below: the camera may orbit under the
            // water, and the view turns underwater there by itself
            maxPolarAngle={Math.PI * 0.95}
            onStart={() => setIsOrbitControlsActive(true)}
            onEnd={() => setIsOrbitControlsActive(false)}
          />
          <SceneCameraFollow />
          <SceneRenderPipeline />
          <SceneAdaptiveResolution />
          <ZoomControlsBridge />
        </Canvas>
        <ZoomControlsOverlay />
        {IS_RENDERER_BADGE_ENABLED && <RendererBackendBadge isWebGPU={isWebGPU} />}
        {IS_SCENE_STATS_ENABLED && <SceneStatsOverlay />}
        {isDiagnosticsOn && <SceneDiagnosticsOverlay />}
      </ZoomControlsProvider>
      </ShipVoyageProvider>
      </CameraMotionProvider>
    </SceneInteractionProvider>
  );
}


