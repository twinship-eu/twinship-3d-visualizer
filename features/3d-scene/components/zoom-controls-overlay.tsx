"use client";

import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/features/ship-visualizer/ship-visualizer-config";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three/webgpu";
import { Anchor, Navigation, RotateCw, Ship, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCameraMotion } from "./camera-motion-context";
import { useShipVoyage } from "./ship-voyage-context";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type Point = [number, number, number];

type ZoomActions = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  /** Glides the camera to a position, looking at a target, over CAMERA_MOVE_SECONDS. */
  moveCameraTo: (position: Point, target: Point) => void;
};

/** How long `moveCameraTo` takes, in seconds. */
const CAMERA_MOVE_SECONDS = 0.8;

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

  /** A camera move under way: where from and to, and how far through, 0 to 1. */
  const move = useRef<{
    fromPosition: Vector3;
    toPosition: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    progress: number;
  } | null>(null);

  const moveCameraTo = useCallback(
    (position: Point, target: Point) => {
      const orbitTarget =
        controls && "target" in controls ? controls.target : new Vector3();
      move.current = {
        fromPosition: camera.position.clone(),
        toPosition: new Vector3(...position),
        fromTarget: orbitTarget.clone(),
        toTarget: new Vector3(...target),
        progress: 0,
      };
    },
    [camera, controls]
  );

  useFrame((_, delta) => {
    const current = move.current;
    if (!current) return;
    current.progress = Math.min(1, current.progress + delta / CAMERA_MOVE_SECONDS);
    // Eased out: fast away, gently into place
    const eased = 1 - (1 - current.progress) ** 3;
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    if (controls && "target" in controls) {
      controls.target.lerpVectors(current.fromTarget, current.toTarget, eased);
      controls.update();
    }
    if (current.progress >= 1) move.current = null;
  });

  useEffect(() => {
    setActions({ zoomIn, zoomOut, resetZoom, moveCameraTo });
    return () => setActions(null);
  }, [setActions, zoomIn, zoomOut, resetZoom, moveCameraTo]);

  return null;
}

/** Fixed DOM overlay; render outside Canvas so it does not move with zoom. */
export function ZoomControlsOverlay() {
  const actions = useZoomControls();
  const { isRidingShip, setIsRidingShip } = useCameraMotion();
  const { isTraveling, setIsTraveling } = useShipVoyage();

  if (!actions) return null;

  return (
    <div
      /*
        Below lg the controls sit just above the hint bar, which is 16px off the
        bottom and about 36px tall. 76px leaves a 24px gap between them.
      */
      className="pointer-events-none absolute left-3 bottom-[76px] z-20 flex flex-col items-center gap-1 lg:left-auto lg:right-4 lg:bottom-4"
      aria-label="Zoom controls"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-lg border border-glass-line bg-glass p-[3px] text-ink backdrop-blur">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={actions.zoomIn}
          className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:size-9"
        >
          <ZoomIn className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={actions.zoomOut}
          className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:size-9"
        >
          <ZoomOut className="h-4 w-4" aria-hidden />
        </button>
        <div className="h-px w-6 bg-line" aria-hidden />
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={actions.resetZoom}
          className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:size-9"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
        <div className="h-px w-6 bg-line" aria-hidden />
        <button
          type="button"
          aria-label="Ride with the ship"
          aria-pressed={isRidingShip}
          title={isRidingShip ? "Stop riding with the ship" : "Ride with the ship"}
          onClick={() => setIsRidingShip(!isRidingShip)}
          className={cn(
            "flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:size-9",
            isRidingShip && "bg-accent text-white hover:bg-accent"
          )}
        >
          <Ship className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={isTraveling ? "Stop the ship" : "Set the ship under way"}
          aria-pressed={isTraveling}
          title={isTraveling ? "Stop the ship" : "Set the ship under way"}
          onClick={() => setIsTraveling(!isTraveling)}
          className={cn(
            "flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:size-9",
            isTraveling && "bg-accent text-white hover:bg-accent"
          )}
        >
          {isTraveling ? (
            <Navigation className="h-4 w-4" aria-hidden />
          ) : (
            <Anchor className="h-4 w-4" aria-hidden />
          )}
        </button>

      </div>
    </div>
  );
}
