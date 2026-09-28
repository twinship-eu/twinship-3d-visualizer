"use client";

import { useEffect } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { shipSpeedOverride } from "@/features/3d-scene/components/ship-voyage-context";

/**
 * In Live data: the ship in the scene, when under way, sails at its live
 * speed over ground rather than the sea's default. Back to the default when
 * Live data is left.
 */
export function LiveShipSpeed() {
  const speed = useLiveData()?.navigation.speedOverGroundKn ?? null;

  useEffect(() => {
    shipSpeedOverride.knots = speed;
  }, [speed]);

  useEffect(
    () => () => {
      shipSpeedOverride.knots = null;
    },
    []
  );

  return null;
}
