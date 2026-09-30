"use client";

import { useEffect } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { liveSceneOverrides } from "@/features/3d-scene/lib/live-scene-overrides";
import { DEFAULT_SEA, useSeaControls } from "@/features/3d-scene/lib/sea-controls-store";
import { wrapSigned } from "../lib/voyage-math";

const METRES_PER_SECOND_PER_KNOT = 0.514444;

/**
 * The scene drawn from the ship's data: the ship under way sails at its speed
 * over ground, its propellers turn at the shafts' speed, and the sea is the
 * one the true wind raises, its waves coming from the wind's side of the bow.
 * Back to the scene's own defaults without data.
 *
 * In the Ontology the sea is the user's to set (`SeaControls`): the wind's
 * speed and the waves' side, each the data's until moved — and the scene's
 * defaults without data.
 */
export function LiveSceneSync({ isUserSea = false }: { isUserSea?: boolean }) {
  const snapshot = useLiveData();
  const seaControls = useSeaControls();
  const speedKnots = snapshot?.navigation.speedOverGroundKn ?? null;
  const shaftRpm = snapshot?.systems.propulsion.shaftRpm ?? null;
  const windSpeedKn = snapshot?.navigation.trueWind.speedKn ?? null;
  const windFromDeg = snapshot?.navigation.trueWind.fromDeg ?? null;
  const headingDeg = snapshot?.navigation.headingDeg ?? null;

  const hasDataWind = windSpeedKn !== null && windFromDeg !== null && headingDeg !== null;
  const dataSpeedMs = hasDataWind ? windSpeedKn * METRES_PER_SECOND_PER_KNOT : null;
  const dataSide = hasDataWind ? wrapSigned(windFromDeg - headingDeg) : null;
  const userSpeed = seaControls.speedMs;
  const userSide = seaControls.fromRelativeDeg;

  useEffect(() => {
    liveSceneOverrides.shipSpeedKnots = speedKnots;
    liveSceneOverrides.propellerRpm = shaftRpm;
    liveSceneOverrides.wind = isUserSea
      ? {
          speedMs: userSpeed ?? dataSpeedMs ?? DEFAULT_SEA.speedMs,
          fromRelativeDeg: userSide ?? dataSide ?? DEFAULT_SEA.fromRelativeDeg,
          // Taken at once only once the user has moved a slider; until then the data's, as in Live data
          isUserSet: userSpeed !== null || userSide !== null,
        }
      : dataSpeedMs !== null && dataSide !== null
        ? { speedMs: dataSpeedMs, fromRelativeDeg: dataSide }
        : null;
  }, [speedKnots, shaftRpm, isUserSea, userSpeed, userSide, dataSpeedMs, dataSide]);

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
