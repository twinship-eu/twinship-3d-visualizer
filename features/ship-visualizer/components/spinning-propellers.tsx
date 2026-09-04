import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import {
  PROPELLER_ANGULAR_SPEED_RAD_S,
  PROPELLER_SPIN_DIRECTIONS,
} from "../ship-visualizer-config";

/**
 * Turns each propeller shaft about its own axis. The groups come from
 * `splitPropellersIntoSpinners`, which already pivots them on their shafts.
 */
export default function SpinningPropellers({ spinners }: { spinners: Group[] }) {
  useFrame((_, delta) => {
    for (let i = 0; i < spinners.length; i++) {
      const direction = PROPELLER_SPIN_DIRECTIONS[i] ?? 1;
      spinners[i].rotation.z += PROPELLER_ANGULAR_SPEED_RAD_S * direction * delta;
    }
  });

  return null;
}
