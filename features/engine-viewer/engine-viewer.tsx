"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneEnvironmentMap } from "@/features/3d-scene/components/scene-environment-map";
import { createSceneRenderer } from "@/features/3d-scene/lib/webgpu-renderer";
import { SceneErrorFallback } from "@/features/ship-visualizer/components/scene-error-fallback";
import { RETURN_QUERY_PARAM } from "@/features/ship-visualizer/ship-visualizer-config";
import { ENGINE_BACKGROUND_COLOR, ENGINE_CAMERA, ENGINE_MAX_PIXEL_RATIO } from "./engine-viewer-config";
import { EngineLoadOverlay } from "./components/engine-load-overlay";
import { EngineModel } from "./components/engine-model";

/** The ship page as it was left — its query only, so the link stays on the ship page. */
function useShipHref() {
  const shipQuery = useSearchParams().get(RETURN_QUERY_PARAM);
  return shipQuery ? `/?${new URLSearchParams(shipQuery)}` : "/";
}

/** A scene with just the engine: orbit, zoom and pan around it. */
export function EngineViewer() {
  const shipHref = useShipHref();

  return (
    <div className="relative h-full min-h-0 w-full" style={{ backgroundColor: ENGINE_BACKGROUND_COLOR }}>
      <SceneErrorFallback
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-white/80">
            The engine could not be shown.
          </div>
        }
      >
        <Canvas
          gl={createSceneRenderer}
          dpr={[1, ENGINE_MAX_PIXEL_RATIO]}
          camera={{ fov: ENGINE_CAMERA.FOV }}
        >
          {/* Lights metal from a baked sky; skipped by the device paths that cannot sample it */}
          <SceneEnvironmentMap />
          <Suspense fallback={null}>
            <EngineModel />
          </Suspense>
        </Canvas>
      </SceneErrorFallback>
      <Link
        href={shipHref}
        className="absolute left-4 top-4 flex items-center gap-1.5 rounded-md bg-black/40 px-3 py-1.5 text-sm text-white/90 hover:bg-black/60"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Back to ship
      </Link>
      <EngineLoadOverlay />
    </div>
  );
}
