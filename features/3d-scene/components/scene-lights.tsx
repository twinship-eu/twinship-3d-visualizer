"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Vector3,
  type AmbientLight,
  type DirectionalLight,
  type HemisphereLight,
} from "three/webgpu";
import {
  ANDROID_AMBIENT_COLOR,
  ANDROID_FILL_COLOR,
  ANDROID_HEMISPHERE_GROUND_COLOR,
  ANDROID_HEMISPHERE_SKY_COLOR,
  ANDROID_METALNESS_SCALE,
  ENVIRONMENT_MAP_INTENSITY,
  getShadowLightPosition,
  SHADOW_LIGHT_DISTANCE,
  IS_ENVIRONMENT_LIGHTING_ENABLED,
  IS_SCENE_INSPECTOR_ENABLED,
  LIGHT_INTENSITY,
  SHADOW_CAMERA_EXTENT,
  SHADOW_CAMERA_FAR,
  SHADOW_CAMERA_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from "../lib/3d-scene-config";
import { SHIP_MATERIAL_TUNING } from "../lib/scene-material-tuning";
import {
  asSceneRenderer,
  canAssignEnvironmentProbe,
  getSceneInspector,
  TONE_MAPPING_EXPOSURE,
} from "../lib/webgpu-renderer";
import { weatherState } from "../lib/seascape-weather";
import { updateSeaShadow } from "../lib/seascape-shadow";
import { skyState } from "../lib/sky-state";
import { getPerformanceProfile } from "../lib/performance-profile";

const SUN_POS = getShadowLightPosition();

/** Opposite the sun on the horizontal, a bit lower — softens the dark hull side. */
const fillPosition = (sun: Vector3) => new Vector3(-sun.x, Math.max(sun.y * 0.45, 20), -sun.z);
const FILL_POS = fillPosition(SUN_POS);
/** The fills (the phones' stand-in for the sky) at night: the share of their day strength they keep. */
const NIGHT_FILL_SHARE = 0.4;

/**
 * Live values behind the Inspector's Lights panel.
 *
 * Seeded from the configured defaults, then applied to the scene every frame
 * while the Inspector is on. Once a combination looks right, copy the numbers
 * back into `3d-scene-config.ts` — nothing here persists across a reload.
 */
const LIGHT_TUNING = {
  sun: LIGHT_INTENSITY.sun,
  /** Whether the baked sky probe lights the ship at all. */
  skyLightsShip: IS_ENVIRONMENT_LIGHTING_ENABLED,
  environment: ENVIRONMENT_MAP_INTENSITY,
  ambient: LIGHT_INTENSITY.androidAmbient,
  ambientColor: ANDROID_AMBIENT_COLOR,
  hemisphere: LIGHT_INTENSITY.androidHemisphere,
  hemisphereSky: ANDROID_HEMISPHERE_SKY_COLOR,
  hemisphereGround: ANDROID_HEMISPHERE_GROUND_COLOR,
  fill: LIGHT_INTENSITY.androidFill,
  fillColor: ANDROID_FILL_COLOR,
  exposure: TONE_MAPPING_EXPOSURE,
};

/** The sun's shadow map: SHADOW_MAP_SIZE, or the profile's smaller one on a phone. */
const shadowMapSize = Math.min(SHADOW_MAP_SIZE, getPerformanceProfile().shadowMapSize);
/** How often the shadow map is redrawn, in frames — see `shadowRedrawFrames`. */
const SHADOW_REDRAW_FRAMES = getPerformanceProfile().shadowRedrawFrames;

export function SceneLights() {
  const gl = useThree((state) => state.gl);
  const sunRef = useRef<DirectionalLight>(null);
  const ambientRef = useRef<AmbientLight>(null);
  const hemisphereRef = useRef<HemisphereLight>(null);
  const fillRef = useRef<DirectionalLight>(null);
  const framesSinceShadowRef = useRef(0);
  // Read once: the UA / query string do not change for the life of the page.
  const useMobileFill = !canAssignEnvironmentProbe();

  useEffect(() => {
    if (!useMobileFill) return;
    // Start the no-env path on the metalness that can actually take diffuse
    // light; the Inspector can still push it live.
    SHIP_MATERIAL_TUNING.metalnessScale = ANDROID_METALNESS_SCALE;
  }, [useMobileFill]);

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Lights");
    panel.add(LIGHT_TUNING, "sun", 0, 20, 0.1);
    if (useMobileFill) {
      // Substitute for the skipped sky probe. Tune under `?forceNoEnv` on
      // desktop, then copy the numbers into `3d-scene-config.ts`.
      panel.add(LIGHT_TUNING, "ambient", 0, 10, 0.05);
      panel.addColor(LIGHT_TUNING, "ambientColor");
      panel.add(LIGHT_TUNING, "hemisphere", 0, 20, 0.05);
      panel.addColor(LIGHT_TUNING, "hemisphereSky");
      panel.addColor(LIGHT_TUNING, "hemisphereGround");
      panel.add(LIGHT_TUNING, "fill", 0, 20, 0.05);
      panel.addColor(LIGHT_TUNING, "fillColor");
    } else {
      // Lights the metal via the baked sky probe, and is not blocked by shadows.
      panel.add(LIGHT_TUNING, "skyLightsShip");
      panel.add(LIGHT_TUNING, "environment", 0, 3, 0.05);
    }
    // Scales the whole image, sky included, unlike the lights above.
    panel.add(LIGHT_TUNING, "exposure", 0, 1.5, 0.01);
    // Without a probe this is the main lever for the fills to reach the hull.
    panel.add(SHIP_MATERIAL_TUNING, "metalnessScale", 0, 1, 0.05);
  }, [gl, useMobileFill]);

  // Applied per frame rather than through change handlers: it is a handful of
  // assignments, and it cannot drift out of sync with the panel.
  //
  // Scene and renderer come from the frame state rather than `useThree`, which
  // hands back values react-hooks will not let a component mutate.
  useFrame((state) => {
    // The sun as much as the clouds let through (`seascape-weather.ts`)
    const sun = IS_SCENE_INSPECTOR_ENABLED ? LIGHT_TUNING.sun : LIGHT_INTENSITY.sun;
    if (sunRef.current) {
      // ...and as much as the hour gives: where the sun is, in its colour, none at night
      sunRef.current.intensity = sun * weatherState.sunlight * skyState.lightStrength;
      sunRef.current.color.copy(skyState.lightColor);
      sunRef.current.position.copy(skyState.lightDirection).multiplyScalar(SHADOW_LIGHT_DISTANCE);
      // The water reads the same shadow map
      updateSeaShadow(sunRef.current);
    }
    // The shadow map only every few frames, not by itself every frame
    if (sunRef.current) {
      sunRef.current.shadow.autoUpdate = false;
      framesSinceShadowRef.current++;
      if (framesSinceShadowRef.current >= SHADOW_REDRAW_FRAMES) {
        sunRef.current.shadow.needsUpdate = true;
        framesSinceShadowRef.current = 0;
      }
    }
    // The phones' fills follow the hour too
    const fillShare = NIGHT_FILL_SHARE + (1 - NIGHT_FILL_SHARE) * skyState.daylight;
    if (fillRef.current) fillRef.current.position.copy(fillPosition(skyState.lightDirection).multiplyScalar(SHADOW_LIGHT_DISTANCE));
    // The probe the metal reflects: as strong as the hour leaves it
    if (!useMobileFill) {
      const probe = IS_SCENE_INSPECTOR_ENABLED
        ? LIGHT_TUNING.skyLightsShip
          ? LIGHT_TUNING.environment
          : 0
        : IS_ENVIRONMENT_LIGHTING_ENABLED
          ? ENVIRONMENT_MAP_INTENSITY
          : 0;
      state.scene.environmentIntensity = probe * skyState.environmentLevel;
    }
    if (!IS_SCENE_INSPECTOR_ENABLED) {
      if (ambientRef.current) ambientRef.current.intensity = LIGHT_INTENSITY.androidAmbient * fillShare;
      if (hemisphereRef.current) hemisphereRef.current.intensity = LIGHT_INTENSITY.androidHemisphere * fillShare;
      if (fillRef.current) fillRef.current.intensity = LIGHT_INTENSITY.androidFill * fillShare;
      return;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = LIGHT_TUNING.ambient * fillShare;
      ambientRef.current.color.set(LIGHT_TUNING.ambientColor);
    }
    if (hemisphereRef.current) {
      hemisphereRef.current.intensity = LIGHT_TUNING.hemisphere * fillShare;
      hemisphereRef.current.color.set(LIGHT_TUNING.hemisphereSky);
      hemisphereRef.current.groundColor.set(LIGHT_TUNING.hemisphereGround);
    }
    if (fillRef.current) {
      fillRef.current.intensity = LIGHT_TUNING.fill * fillShare;
      fillRef.current.color.set(LIGHT_TUNING.fillColor);
    }
    asSceneRenderer(state.gl).toneMappingExposure = LIGHT_TUNING.exposure;
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
        intensity={LIGHT_INTENSITY.sun}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={SHADOW_CAMERA_NEAR}
        shadow-camera-far={SHADOW_CAMERA_FAR}
        shadow-camera-left={-SHADOW_CAMERA_EXTENT}
        shadow-camera-right={SHADOW_CAMERA_EXTENT}
        shadow-camera-top={SHADOW_CAMERA_EXTENT}
        shadow-camera-bottom={-SHADOW_CAMERA_EXTENT}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
      />
      {useMobileFill && (
        <>
          <ambientLight
            ref={ambientRef}
            color={ANDROID_AMBIENT_COLOR}
            intensity={LIGHT_INTENSITY.androidAmbient}
          />
          <hemisphereLight
            ref={hemisphereRef}
            args={[
              ANDROID_HEMISPHERE_SKY_COLOR,
              ANDROID_HEMISPHERE_GROUND_COLOR,
              LIGHT_INTENSITY.androidHemisphere,
            ]}
          />
          <directionalLight
            ref={fillRef}
            position={[FILL_POS.x, FILL_POS.y, FILL_POS.z]}
            intensity={LIGHT_INTENSITY.androidFill}
            color={ANDROID_FILL_COLOR}
          />
        </>
      )}
    </>
  );
}
