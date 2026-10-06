"use client";

import { useEffect } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { liveSceneOverrides } from "@/features/3d-scene/lib/live-scene-overrides";
import { DEFAULT_SEA, useSeaControls } from "@/features/3d-scene/lib/sea-controls-store";
import { ONTOLOGY_DEFAULT_HOUR_UTC, useSkyControls } from "@/features/3d-scene/lib/sky-controls-store";
import { sunForClock } from "@/features/3d-scene/lib/sun-for-clock";
import { VOYAGE_HOUR_UTC } from "../cockpit-voyage";
import { wrapSigned } from "../lib/voyage-math";

const METRES_PER_SECOND_PER_KNOT = 0.514444;

/**
 * The scene drawn from the ship's data: the ship under way sails at its speed
 * over ground, its propellers turn at the shafts' speed, and the sea is the
 * one the true wind raises, its waves coming from the wind's side of the bow.
 * Back to the scene's own defaults without data. The sun is where the data's
 * place and own clock put it in the sky (`solarPosition`) — the hour is the
 * user's to set in the Ontology, as the sea is.
 *
 * In the Ontology the sea is the user's to set (`SeaControls`): the wind's
 * speed and the waves' side, each the data's until moved — and the scene's
 * defaults without data.
 */
export function LiveSceneSync({ isUserSea = false, isVoyageView = false }: { isUserSea?: boolean; isVoyageView?: boolean }) {
  const snapshot = useLiveData();
  const seaControls = useSeaControls();
  const skyControls = useSkyControls();
  // The sun high in both views, on the data's day and at its place, so the ship is seen in full colour;
  // the hour the user sets replaces it
  const hourUtc = skyControls.hourUtc ?? (isVoyageView ? VOYAGE_HOUR_UTC : ONTOLOGY_DEFAULT_HOUR_UTC);
  const speedKnots = snapshot?.navigation.speedOverGroundKn ?? null;
  const shaftRpm = snapshot?.systems.propulsion.shaftRpm ?? null;
  const windSpeedKn = snapshot?.navigation.trueWind.speedKn ?? null;
  const windFromDeg = snapshot?.navigation.trueWind.fromDeg ?? null;
  const headingDeg = snapshot?.navigation.headingDeg ?? null;
  const observedAt = snapshot?.observedAt ?? null;
  const latitude = snapshot?.navigation.position?.latitude ?? null;
  const longitude = snapshot?.navigation.position?.longitude ?? null;

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

  // The sun: where the data's moment puts it, or the hour the user set on that day (the time now without data)
  useEffect(() => {
    if (observedAt === null && hourUtc === null) {
      liveSceneOverrides.sun = null;
      return;
    }
    const position = latitude !== null && longitude !== null ? { latitude, longitude } : null;
    const { azimuthDeg, elevationDeg } = sunForClock(observedAt, hourUtc, position);
    liveSceneOverrides.sun = { elevationDeg, azimuthDeg, headingDeg: headingDeg ?? 0 };
  }, [observedAt, hourUtc, latitude, longitude, headingDeg]);

  useEffect(
    () => () => {
      liveSceneOverrides.sun = null;
      liveSceneOverrides.shipSpeedKnots = null;
      liveSceneOverrides.propellerRpm = null;
      liveSceneOverrides.wind = null;
    },
    []
  );

  return null;
}
