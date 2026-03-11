import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/features/ship-visualizer/ship-visualizer-config";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export default function ZoomControlsOverlay() {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as OrbitControlsImpl | undefined,
  }));

  const handleZoomIn = useCallback(() => {
    if (controls && "dollyIn" in controls) {
      controls.dollyOut(1.2);
      controls.update();
      return;
    }
    camera.position.multiplyScalar(0.8);
  }, [camera, controls]);

  const handleZoomOut = useCallback(() => {
    if (controls && "dollyOut" in controls) {
      controls.dollyIn(1.2);
      controls.update();
      return;
    }
    camera.position.multiplyScalar(1.25);
  }, [camera, controls]);

  const handleResetZoom = useCallback(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    if (controls && "target" in controls) {
      controls.target.set(...DEFAULT_CAMERA_TARGET);
      controls.update();
    }
  }, [camera, controls]);

  return (
    <Html fullscreen transform={false} className="pointer-events-none">
      <div className="pointer-events-auto absolute left-4 bottom-24 z-20 flex flex-col items-center gap-1">
        <div className="flex flex-col items-center gap-1 rounded-md bg-white/95 p-1 shadow-md">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={handleZoomIn}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={handleZoomOut}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <div className="h-px w-6 bg-gray-200" aria-hidden />
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={handleResetZoom}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </Html>
  );
}