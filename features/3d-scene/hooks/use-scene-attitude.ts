"use client";

import { useEffect, useState } from "react";
import { ROLL_NATURAL_PERIOD_S, shipMotion } from "../lib/seascape-ship-motion";

/** How often the attitude is read from the scene, ms: a display's rate, not a frame's. */
const READ_INTERVAL_MS = 250;
/** Share of the heave's peak kept each read: the amplitude shown fades over some seconds. */
const HEAVE_PEAK_KEPT = 0.99;
const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * The ship's attitude as the scene draws it on its waves — roll and pitch,
 * the heave's amplitude, the roll's natural period: for an attitude display
 * where no data reports one (the Ontology). Roll starboard down positive,
 * pitch bow up positive, as the live data's.
 */
export function useSceneAttitude() {
  const [attitude, setAttitude] = useState({ rollDeg: 0, pitchDeg: 0, heaveM: 0, rollPeriodS: ROLL_NATURAL_PERIOD_S });

  useEffect(() => {
    let heavePeak = 0;
    const timer = window.setInterval(() => {
      heavePeak = Math.max(Math.abs(shipMotion.waveY), heavePeak * HEAVE_PEAK_KEPT);
      setAttitude({
        rollDeg: shipMotion.shownRoll * DEGREES_PER_RADIAN,
        pitchDeg: -shipMotion.shownPitch * DEGREES_PER_RADIAN,
        heaveM: heavePeak,
        rollPeriodS: ROLL_NATURAL_PERIOD_S,
      });
    }, READ_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return attitude;
}
