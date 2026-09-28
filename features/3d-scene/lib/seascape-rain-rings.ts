/**
 * Seascape — 22. Rain on the water
 *
 * Every raindrop that lands sends out a small ring. The sea is split into
 * Voronoi-like cells, RING_CELL across, and each cell has a drop landing at
 * its own random point and moment, again and again: its ring spreads out and
 * fades. A point checks the rings of its own cell and the eight around it.
 *
 * Only the slope — the rings shape the light, not the geometry — and only
 * near the camera, where rings a few tens of centimetres across can be seen.
 */
import { cos, exp, float, floor, fract, Fn, sin, smoothstep, sqrt, vec2 } from "three/tsl";
import type { Node } from "three/webgpu";

/** Size of a cell, in world units: one drop at a time in each. */
const RING_CELL = 1.2;
/** How long a ring lasts, in seconds, and how far it spreads in that time, in world units. */
const RING_LIFETIME = 0.9;
const RING_REACH = 0.7;
/** The ring's ripples: their wavelength and how wide the band of them is, in world units. */
const RING_WAVELENGTH = 0.12;
const RING_WIDTH = 0.08;
/** How steep a fresh ring is. */
const RING_STEEPNESS = 0.9;

/** Two pseudo-random numbers in [0, 1) for a cell. */
function hash2(cell: Node<"vec2">) {
  const p = vec2(cell.dot(vec2(127.1, 311.7)), cell.dot(vec2(269.5, 183.3)));

  return fract(vec2(sin(p.x), sin(p.y)).mul(43758.5453));
}

/**
 * The rain's rings' slope at a point of the sea (x, z), in world units, at
 * full rain: to be scaled by how hard it rains.
 */
export const rainRingsSlope = Fn(
  // The time as a parameter: a uniform read only inside a Fn with a layout
  // is not declared by three r183, and the shader fails to compile
  ([position, time]: [Node<"vec2">, Node<"float">]) => {
    const inCells = position.div(RING_CELL);
    const cell = floor(inCells);
    const slope = vec2(0.0).toVar();

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbour = cell.add(vec2(dx, dy));
        const random = hash2(neighbour);
        // Where in its cell the drop lands, and when: each cell its own moment,
        // and its own point each time a drop lands
        const moment = time.div(RING_LIFETIME).add(random.x);
        const age = fract(moment);
        const landing = hash2(neighbour.add(floor(moment).mul(vec2(7.3, 3.1))));
        const centre = neighbour.add(landing).mul(RING_CELL);

        const offset = position.sub(centre);
        const distance = sqrt(offset.dot(offset)).max(1e-4);
        const radius = age.mul(RING_REACH);
        const fromRing = distance.sub(radius);
        const band = exp(fromRing.div(RING_WIDTH).mul(fromRing.div(RING_WIDTH)).negate());
        const ripple = cos(fromRing.mul((2 * Math.PI) / RING_WAVELENGTH));
        const fade = float(1.0).sub(age).mul(smoothstep(0.0, 0.08, age));

        slope.addAssign(offset.div(distance).mul(ripple.mul(band).mul(fade).mul(RING_STEEPNESS)));
      }
    }

    return slope;
  },
  { position: "vec2", time: "float", return: "vec2" }
);
