import { Suspense } from "react";
import { ShipVisualizer } from "@/features/ship-visualizer/ship-visualizer";

export default function ShipVisualizerPage() {
  return (
    <div className="flex h-full w-full min-h-0">
      {/* The viewer reads the URL's search params (nuqs): the build prerenders the page up to this boundary */}
      <Suspense fallback={null}>
        <ShipVisualizer />
      </Suspense>
    </div>
  );
}
