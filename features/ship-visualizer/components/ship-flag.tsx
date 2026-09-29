import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three/webgpu";
import { apparentWind } from "../../3d-scene/lib/seascape-weather";
import { hoistEuFlag, type ShipFlag } from "../lib/ship-flag";

/**
 * The EU flag at the bow, flying in the wind the ship feels — the true wind
 * and its own way — so its motion shows even from afar (see `hoistEuFlag`).
 */
export default function ShipFlagCloth({ root }: { root: Object3D }) {
  const flag = useRef<ShipFlag | null>(null);

  useEffect(() => {
    flag.current = hoistEuFlag(root);
    if (!flag.current) console.warn("Ship flag: the model's bow pennant was not found; no flag hoisted.");
    return () => {
      flag.current?.dispose();
      flag.current = null;
    };
  }, [root]);

  useFrame(({ clock }, delta) => flag.current?.update(clock.elapsedTime, delta, apparentWind));

  return null;
}
