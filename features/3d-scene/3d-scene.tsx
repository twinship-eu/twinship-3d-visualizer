"use client";

import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { ACESFilmicToneMapping, HalfFloatType, PCFShadowMap, Vector3 } from "three";
import { DEFAULT_CAMERA_POSITION } from "../ship-visualizer/ship-visualizer-config";
import { OrbitControls } from "@react-three/drei";
import { SCENE_BACKGROUND_COLOR } from "./lib/3d-scene-config";
import { SceneLights } from "./scene-lights";
import { SceneSky } from "./scene-sky";
import { SceneWater } from "./scene-water";
import { useState } from "react";
import { SceneInteractionProvider } from "./scene-interaction-context";

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
  sceneScale = 1,
}: Props) {
  return (
    <div
      className={cn(className ?? "h-full min-h-0 w-full")}
      style={{ backgroundColor: SCENE_BACKGROUND_COLOR }}
    >
      <SceneWithInteraction>{children}</SceneWithInteraction>
    </div>
  );
}

function SceneWithInteraction({ children }: { children: React.ReactNode }) {
  const [isOrbitControlsActive, setIsOrbitControlsActive] = useState(false);

  return (
    <SceneInteractionProvider value={{ isOrbitControlsActive }}>
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
      </Canvas>
    </SceneInteractionProvider>
  );
}
