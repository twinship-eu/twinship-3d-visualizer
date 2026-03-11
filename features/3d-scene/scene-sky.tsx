"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky as ThreeSky } from "three/examples/jsm/objects/Sky.js";
import {
  getSunDirection,
  SKY_SCALE,
  SKY_UNIFORMS,
} from "./lib/3d-scene-config";

type SkyUniforms = {
  sunPosition: { value: ReturnType<typeof getSunDirection> };
  turbidity: { value: number };
  rayleigh: { value: number };
  mieCoefficient: { value: number };
  mieDirectionalG: { value: number };
  cloudCoverage: { value: number };
  cloudDensity: { value: number };
  cloudElevation: { value: number };
  time: { value: number };
};

export function SceneSky() {
  const skyRef = useRef<ThreeSky>(null);

  const sky = useMemo(() => {
    const s = new ThreeSky();
    s.scale.setScalar(SKY_SCALE);
    const mat = s.material as unknown as { uniforms: SkyUniforms };
    mat.uniforms.sunPosition.value.copy(getSunDirection());
    mat.uniforms.turbidity.value = SKY_UNIFORMS.turbidity;
    mat.uniforms.rayleigh.value = SKY_UNIFORMS.rayleigh;
    mat.uniforms.mieCoefficient.value = SKY_UNIFORMS.mieCoefficient;
    mat.uniforms.mieDirectionalG.value = SKY_UNIFORMS.mieDirectionalG;
    mat.uniforms.cloudCoverage.value = SKY_UNIFORMS.cloudCoverage;
    mat.uniforms.cloudDensity.value = SKY_UNIFORMS.cloudDensity;
    mat.uniforms.cloudElevation.value = SKY_UNIFORMS.cloudElevation;
    return s;
  }, []);

  useFrame((_, delta) => {
    const s = skyRef.current ?? sky;
    const mat = s?.material as unknown as { uniforms: SkyUniforms } | undefined;
    if (mat?.uniforms?.time) mat.uniforms.time.value += delta;
  });

  return <primitive ref={skyRef} object={sky} />;
}
