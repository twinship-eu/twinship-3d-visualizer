/**
 * Seascape — 1. Noise
 *
 * Smooth random values, used to wobble the waves so their crests are not
 * perfectly straight lines.
 *
 * Names in the original GLSL (https://www.shadertoy.com/view/Ms2SD1):
 *   hash   -> hash
 *   noise  -> valueNoise
 */
import { dot, floor, Fn, fract, mix, sin, sub, vec2 } from "three/tsl";
import type { Node } from "three/webgpu";

/**
 * A pseudo-random number in [0, 1) for a 2D grid cell.
 *
 * The classic GPU hash: project the cell onto an arbitrary direction, take the
 * sine, and keep only the digits far after the decimal point.
 */
export const hash = Fn(
  ([cell]: [Node<"vec2">]) => {
    const seed = dot(cell, vec2(127.1, 311.7));

    return fract(sin(seed).mul(43758.5453123));
  },
  { cell: "vec2", return: "float" }
);

/**
 * Smooth value noise in [-1, 1].
 *
 * Picks a random value at each of the four corners of the grid cell the point
 * falls in, then blends between them.
 */
export const valueNoise = Fn(
  ([position]: [Node<"vec2">]) => {
    const cell = floor(position);
    const insideCell = fract(position);

    // 3t² - 2t³ instead of a straight line: the blend eases in and out of each
    // cell, so the noise has no visible creases along the grid lines
    const blend = insideCell.mul(insideCell).mul(sub(3.0, insideCell.mul(2.0)));

    // Random value at each corner
    const bottomLeft = hash(cell);
    const bottomRight = hash(cell.add(vec2(1.0, 0.0)));
    const topLeft = hash(cell.add(vec2(0.0, 1.0)));
    const topRight = hash(cell.add(vec2(1.0, 1.0)));

    // Blend the bottom pair and the top pair along x, then those two along y
    const bottom = mix(bottomLeft, bottomRight, blend.x);
    const top = mix(topLeft, topRight, blend.x);
    const value = mix(bottom, top, blend.y);

    // [0, 1] -> [-1, 1]
    return value.mul(2.0).sub(1.0);
  },
  { position: "vec2", return: "float" }
);
