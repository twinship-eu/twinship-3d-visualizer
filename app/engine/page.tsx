import { Suspense } from "react";
import { EngineViewer } from "@/features/engine-viewer/engine-viewer";

export default function EnginePage() {
  return (
    <div className="flex h-full w-full min-h-0">
      {/* The viewer reads the URL's search params (the way back to the ship): the build prerenders the page up to this boundary */}
      <Suspense fallback={null}>
        <EngineViewer />
      </Suspense>
    </div>
  );
}
