import { getSunPosition, LIGHT_INTENSITY } from "../lib/3d-scene-config";

const SUN_POS = getSunPosition();

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={LIGHT_INTENSITY.ambient} />
      <hemisphereLight intensity={LIGHT_INTENSITY.ambient} />
      <directionalLight
        position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
        intensity={LIGHT_INTENSITY.sun}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
    </>
  );
}