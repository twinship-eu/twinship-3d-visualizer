import { useFrame } from "@react-three/fiber";
import { Group } from "three/webgpu";
import { shipMotion } from "../../3d-scene/lib/seascape-ship-motion";
import {
  PROPELLER_ANGULAR_SPEED_RAD_S,
  PROPELLER_SPIN_DIRECTIONS,
} from "../ship-visualizer-config";

/**
 * Under way the propellers turn faster: at this speed through the water, in
 * m/s (18 knots), they turn UNDER_WAY_SPIN times as fast as at rest.
 */
const FULL_SPEED = 9.26;
const UNDER_WAY_SPIN = 4;

/**
 * Turns each propeller shaft about its own axis. The groups come from
 * `splitPropellersIntoSpinners`, which already pivots them on their shafts.
 */
export default function SpinningPropellers({ spinners }: { spinners: Group[] }) {
  useFrame((_, delta) => {
    const underWay = Math.min(Math.max(shipMotion.speed / FULL_SPEED, 0), 1);
    const spin = PROPELLER_ANGULAR_SPEED_RAD_S * (1 + (UNDER_WAY_SPIN - 1) * underWay);
    for (let i = 0; i < spinners.length; i++) {
      const direction = PROPELLER_SPIN_DIRECTIONS[i] ?? 1;
      // rotateZ turns it about its own z, as `rotation.z +=` did, and does not
      // write to the prop the lint rule forbids changing
      spinners[i].rotateZ(spin * direction * delta);
    }
  });

  return null;
}
