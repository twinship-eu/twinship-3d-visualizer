"use client";

import { useSceneAttitude } from "@/features/3d-scene/hooks/use-scene-attitude";
import { AttitudeCard } from "../voyage/voyage-instruments";

/**
 * Over the Ontology's scene, top right: the attitude the ship is drawn at on
 * its waves — no data reports one there — so the ship seen and the
 * instrument agree. A part's details card opens under it, bottom right.
 */
export function OntologyAttitude() {
  const attitude = useSceneAttitude();

  return (
    <div data-callout-avoid className="pointer-events-none absolute top-4 right-4 z-20 hidden lg:block">
      <AttitudeCard attitude={attitude} />
    </div>
  );
}
