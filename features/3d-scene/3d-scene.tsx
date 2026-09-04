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
  SCENE_BACKGROUND_COLOR,
} from "./lib/3d-scene-config";
import { SceneLights } from "./components/scene-lights";
import { SceneSky } from "./components/scene-sky";
import { SceneEnvironmentMap } from "./components/scene-environment-map";
import { SceneWater } from "./components/scene-water";
import { createSceneRenderer } from "./lib/webgpu-renderer";
import { RendererBackendProbe } from "./components/renderer-backend-probe";
import { RendererBackendBadge } from "./components/renderer-backend-badge";
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
  /** Scale for grid/fog (e.g. from model bounds); default 1. */
  sceneScale?: number;
};



export function Scene({
  className,
  children,
}: Props) {
  return (
    <div
      className={cn("relative", className ?? "h-full min-h-0 w-full")}
      style={{ backgroundColor: SCENE_BACKGROUND_COLOR }}
    >
      <SceneWithInteraction>{children}</SceneWithInteraction>
      <StageControlHints />
    </div>
  );
}

function SceneWithInteraction({ children }: { children: React.ReactNode }) {
  const [isOrbitControlsActive, setIsOrbitControlsActive] = useState(false);
  const [isWebGPU, setIsWebGPU] = useState<boolean | null>(null);

  return (
    <SceneInteractionProvider value={{ isOrbitControlsActive }}>
      <ZoomControlsProvider>
        <Canvas
          shadows
          camera={{
            position: new Vector3(...DEFAULT_CAMERA_POSITION),
            fov: 45,
          }}
          gl={createSceneRenderer}
        >
          <RendererBackendProbe onResolved={setIsWebGPU} />
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
      </ZoomControlsProvider>
    </SceneInteractionProvider>
  );
}


