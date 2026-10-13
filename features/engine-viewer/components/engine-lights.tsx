"use client";

import {
  ANDROID_AMBIENT_COLOR,
  ANDROID_HEMISPHERE_GROUND_COLOR,
  ANDROID_HEMISPHERE_SKY_COLOR,
} from "@/features/3d-scene/lib/3d-scene-config";
import { needsNoEnvLightingPath } from "@/features/3d-scene/lib/webgpu-renderer";
import { ENGINE_LIGHTS } from "../engine-viewer-config";

type Props = {
  /** Radius of the sphere enclosing the engine; the lights sit at multiples of it. */
  radius: number;
};

/**
 * Key and fill from opposite sides, and a flat ambient so no face goes black.
 *
 * Devices that skip the sky probe get a substitute for it instead of the faint
 * ambient: a stronger ambient and a sky-to-ground hemisphere, in the ship
 * scene's colours.
 */
export function EngineLights({ radius }: Props) {
  const [keyX, keyY, keyZ] = ENGINE_LIGHTS.KEY_POSITION;
  const [fillX, fillY, fillZ] = ENGINE_LIGHTS.FILL_POSITION;
  const isWithoutSkyProbe = needsNoEnvLightingPath();

  return (
    <>
      {isWithoutSkyProbe ? (
        <>
          <ambientLight color={ANDROID_AMBIENT_COLOR} intensity={ENGINE_LIGHTS.NO_PROBE_AMBIENT} />
          <hemisphereLight
            args={[
              ANDROID_HEMISPHERE_SKY_COLOR,
              ANDROID_HEMISPHERE_GROUND_COLOR,
              ENGINE_LIGHTS.NO_PROBE_HEMISPHERE,
            ]}
          />
        </>
      ) : (
        <ambientLight intensity={ENGINE_LIGHTS.AMBIENT} />
      )}
      <directionalLight
        position={[keyX * radius, keyY * radius, keyZ * radius]}
        intensity={ENGINE_LIGHTS.KEY}
      />
      <directionalLight
        position={[fillX * radius, fillY * radius, fillZ * radius]}
        intensity={ENGINE_LIGHTS.FILL}
      />
    </>
  );
}
