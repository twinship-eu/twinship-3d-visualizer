"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import {
  ACESFilmicToneMapping,
  HalfFloatType,
  PCFShadowMap,
  Vector3,
} from "three";
import {
  DEFAULT_CAMERA_POSITION,
} from "../ship-visualizer/ship-visualizer-config";
import {  OrbitControls } from "@react-three/drei";
import { SCENE_BACKGROUND_COLOR } from "./lib/3d-scene-config";
import { SceneLights } from "./components/scene-lights";
import { SceneSky } from "./components/scene-sky";
import { SceneWater } from "./components/scene-water";
import {  useState } from "react";
import { SceneInteractionProvider } from "./components/scene-interaction-context";
import { StageControlHints } from "./components/stage-control-hints";
import {
  ZoomControlsBridge,
  ZoomControlsOverlay,
  ZoomControlsProvider,
} from "./components/zoom-controls-overlay";


/** Tone mapping exposure; higher for midday (0.1 = dusk, ~0.3 = noon). */
const TONE_MAPPING_EXPOSURE = 0.3;

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

  return (
    <SceneInteractionProvider value={{ isOrbitControlsActive }}>
      <ZoomControlsProvider>
        <Canvas
          shadows
          onCreated={({ gl }) => {
            gl.shadowMap.type = PCFShadowMap;
          }}
          camera={{
            position: new Vector3(...DEFAULT_CAMERA_POSITION),
            fov: 45,
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: TONE_MAPPING_EXPOSURE,
            outputBufferType: HalfFloatType,
          }}
        >
          <SceneSky />
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
      </ZoomControlsProvider>
    </SceneInteractionProvider>
  );
}


