"use client";

import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/features/ship-visualizer/ship-visualizer-config";
import { useThree } from "@react-three/fiber";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type ZoomActions = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

type ZoomControlsContextValue = {
  actions: ZoomActions | null;
  setActions: (actions: ZoomActions | null) => void;
};

const ZoomControlsContext = createContext<ZoomControlsContextValue | null>(
  null
);

export function useZoomControls(): ZoomActions | null {
  const ctx = useContext(ZoomControlsContext);
  return ctx?.actions ?? null;
}

export function ZoomControlsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actions, setActions] = useState<ZoomActions | null>(null);
  return (
    <ZoomControlsContext.Provider value={{ actions, setActions }}>
      {children}
    </ZoomControlsContext.Provider>
  );
}

/** Renders inside Canvas and registers zoom actions with context. */
export function ZoomControlsBridge() {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as OrbitControlsImpl | undefined,
  }));
  const { setActions } = useContext(ZoomControlsContext)!;

  const zoomIn = useCallback(() => {
    if (controls && "dollyIn" in controls) {
      controls.dollyOut(1.2);
      controls.update();
      return;
    }
    camera.position.multiplyScalar(0.8);
  }, [camera, controls]);

  const zoomOut = useCallback(() => {
    if (controls && "dollyOut" in controls) {
      controls.dollyIn(1.2);
      controls.update();
      return;
    }
    camera.position.multiplyScalar(1.25);
  }, [camera, controls]);

  const resetZoom = useCallback(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    if (controls && "target" in controls) {
      controls.target.set(...DEFAULT_CAMERA_TARGET);
      controls.update();
    }
  }, [camera, controls]);

  useEffect(() => {
    setActions({ zoomIn, zoomOut, resetZoom });
    return () => setActions(null);
  }, [setActions, zoomIn, zoomOut, resetZoom]);

  return null;
}

/** Fixed DOM overlay; render outside Canvas so it does not move with zoom. */
export function ZoomControlsOverlay() {
  const actions = useZoomControls();

  if (!actions) return null;

  return (
    <div
      className="pointer-events-none absolute left-4 bottom-24 z-20 flex flex-col items-center gap-1"
      aria-label="Zoom controls"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-md bg-white/95 p-1 shadow-md">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={actions.zoomIn}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ZoomIn className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={actions.zoomOut}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ZoomOut className="h-4 w-4" aria-hidden />
        </button>
        <div className="h-px w-6 bg-gray-200" aria-hidden />
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={actions.resetZoom}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
