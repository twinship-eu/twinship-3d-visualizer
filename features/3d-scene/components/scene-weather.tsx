"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import { CLEAR_WEATHER, setWeather } from "../lib/seascape-weather";
import { asSceneRenderer, getSceneInspector } from "../lib/webgpu-renderer";

/**
 * Live values behind the Inspector's Weather panel, each from 0 to 1. Real
 * weather data will set the same three through `setWeather`.
 */
const WEATHER_TUNING = { ...CLEAR_WEATHER };

/**
 * The weather over the sea: its Weather panel. The sky, the haze, the water,
 * the lights and the rain and snow (drawn by the sea, which knows where its
 * surface is) read the weather themselves (`seascape-weather.ts`).
 */
export function SceneWeather() {
  const get = useThree((state) => state.get);

  useEffect(() => {
    setWeather(CLEAR_WEATHER);
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(get().gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Weather");
    panel.add(WEATHER_TUNING, "cloudCover", 0, 1, 0.01);
    panel.add(WEATHER_TUNING, "rain", 0, 1, 0.01);
    panel.add(WEATHER_TUNING, "snow", 0, 1, 0.01);
  }, [get]);

  // Applied per frame, as the other panels are
  useFrame(() => {
    if (IS_SCENE_INSPECTOR_ENABLED) setWeather(WEATHER_TUNING);
  });

  return null;
}
