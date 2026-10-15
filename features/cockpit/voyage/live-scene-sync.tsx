"use client";

import { useEffect } from "react";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { liveSceneOverrides } from "@/features/3d-scene/lib/live-scene-overrides";
import { DEFAULT_SEA, useSeaControls } from "@/features/3d-scene/lib/sea-controls-store";
import { ONTOLOGY_DEFAULT_HOUR_UTC, ONTOLOGY_SUN_HEADING_DEG, ONTOLOGY_WIND_KN, useSkyControls } from "@/features/3d-scene/lib/sky-controls-store";
import { sunForClock } from "@/features/3d-scene/lib/sun-for-clock";
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
export function LiveSceneSync({ isUserSea = false }: { isUserSea?: boolean; isVoyageView?: boolean }) {
  const snapshot = useLiveData();
  const seaControls = useSeaControls();
  const skyControls = useSkyControls();
  // In Live data the sun follows the cockpit's own clock (the demo's, see DEMO_START_HOUR_UTC), so the
  // time shown and the sky agree; in the Ontology it is high, at its default hour. The user's hour wins
  const hourUtc = skyControls.hourUtc ?? (isUserSea ? ONTOLOGY_DEFAULT_HOUR_UTC : null);
  const speedKnots = snapshot?.navigation.speedOverGroundKn ?? null;
  const shaftRpm = snapshot?.systems.propulsion.shaftRpm ?? null;
  const windSpeedKn = snapshot?.navigation.trueWind.speedKn ?? null;
  // The sea's height as the data reports it, for the scene to raise its waves to; null when it does not
  const dataWaveHeightM = snapshot?.sea.isWaveHeightRecorded ? snapshot.sea.significantWaveHeightM : null;
  const windFromDeg = snapshot?.navigation.trueWind.fromDeg ?? null;
  const headingDeg = snapshot?.navigation.headingDeg ?? null;
  // The clock the cockpit shows: the snapshot's own stamp, not the recording's moment
  const observedAt = snapshot?.timestamp ?? null;
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
          // A light breeze of its own, not the voyage's wind: the ship to look at, not the weather
          speedMs: userSpeed ?? ONTOLOGY_WIND_KN * METRES_PER_SECOND_PER_KNOT,
          fromRelativeDeg: userSide ?? dataSide ?? DEFAULT_SEA.fromRelativeDeg,
          // Taken at once only once the user has moved a slider; until then the data's side, as in Live data
          isUserSet: userSpeed !== null || userSide !== null,
        }
      : dataSpeedMs !== null && dataSide !== null
        ? { speedMs: dataSpeedMs, fromRelativeDeg: dataSide, significantWaveHeightM: dataWaveHeightM }
        : null;
  }, [speedKnots, shaftRpm, isUserSea, userSpeed, userSide, dataSpeedMs, dataSide, dataWaveHeightM]);

  // The sun: where the data's moment puts it, or the hour the user set on that day (the time now without data)
  useEffect(() => {
    if (observedAt === null && hourUtc === null) {
      liveSceneOverrides.sun = null;
      return;
    }
    const position = latitude !== null && longitude !== null ? { latitude, longitude } : null;
    const { azimuthDeg, elevationDeg } = sunForClock(observedAt, hourUtc, position);
    // The Ontology's ship is turned for the light, not the voyage's heading
    liveSceneOverrides.sun = { elevationDeg, azimuthDeg, headingDeg: isUserSea ? ONTOLOGY_SUN_HEADING_DEG : (headingDeg ?? 0) };
  }, [observedAt, hourUtc, latitude, longitude, headingDeg, isUserSea]);

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
