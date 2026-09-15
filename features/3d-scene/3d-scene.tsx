"use client";

import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { Vector3 } from "three";
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
import { SceneWater } from "./components/scene-water";
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
      <ZoomControlsProvider>
        <Canvas
          // False on Android, where three's own shadow path emits invalid
          // shaders under WebGPU. See canRenderShadows.
          shadows={canRenderShadows()}
          camera={{
            position: new Vector3(...DEFAULT_CAMERA_POSITION),
            fov: 45,
          }}
          gl={createSceneRenderer}
        >
          <RendererBackendProbe onResolved={setIsWebGPU} />
          {IS_SCENE_STATS_ENABLED && <SceneStatsProbe />}
          {isDiagnosticsOn && <SceneDiagnosticsProbe />}
          <SceneSky />
          <SceneEnvironmentMap />
          <SceneWater />
          <SceneLights />
          {children}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={400}
            maxPolarAngle={Math.PI / 2}
            onStart={() => setIsOrbitControlsActive(true)}
            onEnd={() => setIsOrbitControlsActive(false)}
          />
          <ZoomControlsBridge />
        </Canvas>
        <ZoomControlsOverlay />
        {IS_RENDERER_BADGE_ENABLED && <RendererBackendBadge isWebGPU={isWebGPU} />}
        {IS_SCENE_STATS_ENABLED && <SceneStatsOverlay />}
        {isDiagnosticsOn && <SceneDiagnosticsOverlay />}
      </ZoomControlsProvider>
    </SceneInteractionProvider>
  );
}


