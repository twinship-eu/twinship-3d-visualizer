"use client";

import { useEffect } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { liveSceneOverrides } from "@/features/3d-scene/lib/live-scene-overrides";
import { wrapSigned } from "../lib/voyage-math";

const METRES_PER_SECOND_PER_KNOT = 0.514444;

/**
 * The scene drawn from the ship's data: the ship under way sails at its speed
 * over ground, its propellers turn at the shafts' speed, and the sea is the
 * one the true wind raises, its waves coming from the wind's side of the bow.
 * Back to the scene's own defaults without data.
 */
export function LiveSceneSync() {
  const snapshot = useLiveData();
  const speedKnots = snapshot?.navigation.speedOverGroundKn ?? null;
  const shaftRpm = snapshot?.systems.propulsion.shaftRpm ?? null;
  const windSpeedKn = snapshot?.navigation.trueWind.speedKn ?? null;
  const windFromDeg = snapshot?.navigation.trueWind.fromDeg ?? null;
  const headingDeg = snapshot?.navigation.headingDeg ?? null;

  useEffect(() => {
    liveSceneOverrides.shipSpeedKnots = speedKnots;
    liveSceneOverrides.propellerRpm = shaftRpm;
    liveSceneOverrides.wind =
      windSpeedKn === null || windFromDeg === null || headingDeg === null
        ? null
        : { speedMs: windSpeedKn * METRES_PER_SECOND_PER_KNOT, fromRelativeDeg: wrapSigned(windFromDeg - headingDeg) };
  }, [speedKnots, shaftRpm, windSpeedKn, windFromDeg, headingDeg]);

  useEffect(
    () => () => {
      liveSceneOverrides.shipSpeedKnots = null;
      liveSceneOverrides.propellerRpm = null;
      liveSceneOverrides.wind = null;
    },
    []
  );

  return null;
}
