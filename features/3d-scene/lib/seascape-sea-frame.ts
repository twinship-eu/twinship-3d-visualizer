/**
 * Seascape — 19. The sea's frame
 *
 * Where a point of the scene is on the sea. Two things move the sea under the
 * ship, which stays at the origin:
 *
 * - it flows past as the ship sails (`sail`), bow to stern;
 * - it is turned about the ship, so that its waves always come at the bow,
 *   whichever way the wind blows — a ship heading into the waves is what
 *   reads as moving. The turn never changes as the ship sails, so it is never
 *   seen (only a new wind direction from the Inspector turns it).
 *
 * Everything that reads the sea goes through `toSea`, and turns what it reads
 * back with `slopeToWorld`, so the waves' light stays right.
 */
import { uniform, vec2 } from "three/tsl";
import { Vector2, type Node } from "three/webgpu";

export function createSeaFrame() {
  /** Where the ship's origin is on the sea, in the sea's own frame. */
  const offset = uniform(new Vector2());
  /** The sea's turn about the ship: its cosine and sine. */
  const turn = uniform(new Vector2(1, 0));
  let angle = 0;

  /** A point of the scene (x, z), where it is on the sea. */
  function toSea(world: Node<"vec2">) {
    const turned = vec2(
      world.x.mul(turn.x).sub(world.y.mul(turn.y)),
      world.x.mul(turn.y).add(world.y.mul(turn.x))
    );

    return turned.add(offset);
  }

  /** A slope (d/dx, d/dz) read in the sea's frame, turned back into the scene's. */
  function slopeToWorld(slope: Node<"vec2">) {
    return vec2(slope.x.mul(turn.x).add(slope.y.mul(turn.y)), slope.y.mul(turn.x).sub(slope.x.mul(turn.y)));
  }

  /** Flows the sea past the ship by `distance` world units, bow (+z) to stern. */
  function sail(distance: number) {
    // The ship's way (+z), as it is in the sea's frame
    offset.value.x += -Math.sin(angle) * distance;
    offset.value.y += Math.cos(angle) * distance;
  }

  /** Turns the sea to `nextAngle` radians about the ship. */
  function turnTo(nextAngle: number) {
    angle = nextAngle;
    turn.value.set(Math.cos(angle), Math.sin(angle));
  }

  return { offset, turn, toSea, slopeToWorld, sail, turnTo };
}

export type SeaFrame = ReturnType<typeof createSeaFrame>;

/**
 * The turn that brings waves travelling along (travelX, travelZ) on the sea
 * to the ship head-on, travelling towards -z in the scene.
 */
export function headOnTurn(travelX: number, travelZ: number) {
  return Math.atan2(travelX, -travelZ);
}
