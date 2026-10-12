"use client";

import { ENGINE_LIGHTS } from "../engine-viewer-config";

type Props = {
  /** Radius of the sphere enclosing the engine; the lights sit at multiples of it. */
  radius: number;
};

/** Key and fill from opposite sides, and a flat ambient so no face goes black. */
export function EngineLights({ radius }: Props) {
  const [keyX, keyY, keyZ] = ENGINE_LIGHTS.KEY_POSITION;
  const [fillX, fillY, fillZ] = ENGINE_LIGHTS.FILL_POSITION;

  return (
    <>
      <ambientLight intensity={ENGINE_LIGHTS.AMBIENT} />
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
