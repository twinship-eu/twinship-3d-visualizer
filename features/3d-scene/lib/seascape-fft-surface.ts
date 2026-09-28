/**
 * Seascape — 10. The FFT ocean on the surface
 *
 * How the surface reads the FFT ocean's cascades (`seascape-fft-ocean.ts`):
 * each is a tile of height and slopes repeating over its own size, and the
 * sea at a point is the sum of the three.
 *
 * - for the grid's shape, each cascade is read at the mip level whose texels
 *   are about two grid cells across: waves the grid cannot hold average out
 *   instead of turning the crests jagged;
 * - per pixel, the textures pick their own mip level from the pixel's
 *   footprint, so every wave down to a pixel shapes the light, and shorter
 *   ones average into a sheen rather than flickering.
 */
import { float, log2, max, texture, uniform, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { FFT_SIZE, type FftCascade } from "./seascape-fft-ocean";

/** The grid's filter size, in cells: the texels it reads are at least this many cells across. */
const GRID_FILTER_CELLS = 2;

export type FftSurfaceNodes = ReturnType<typeof createFftSurfaceNodes>;

export function createFftSurfaceNodes(cascades: FftCascade[]) {
  const layers = cascades.map((cascade) => ({
    texture: texture(cascade.texture),
    tileSize: uniform(cascade.tileSize),
  }));

  /** Keeps the tile sizes in step with the ocean, after a change of wind. */
  function syncTileSizes() {
    layers.forEach((layer, index) => {
      layer.tileSize.value = cascades[index].tileSize;
    });
  }

  /** The sea's height at a world point, for the grid: filtered to its cell size. */
  function gridHeight(position: Node<"vec2">, cellSize: Node<"float">) {
    let height: Node<"float"> = float(0.0);
    for (const layer of layers) {
      const texel = layer.tileSize.div(FFT_SIZE);
      const level = max(log2(cellSize.mul(GRID_FILTER_CELLS).div(texel)), 0.0);
      height = height.add(texture(layer.texture, position.div(layer.tileSize), level).x);
    }

    return height;
  }

  /**
   * The sea's slope (xy) and height (z) at a world point, per pixel. Must be
   * called outside any branch: the reads take their mip level from derivatives.
   */
  function pixelWaves(position: Node<"vec2">) {
    let waves: Node<"vec3"> = vec3(0.0);
    for (const layer of layers) {
      const sample = texture(layer.texture, position.div(layer.tileSize));
      waves = waves.add(vec3(sample.y, sample.z, sample.x));
    }

    return waves;
  }

  /** The slope alone, as a vec2: see `pixelWaves`. */
  function pixelSlope(waves: Node<"vec3">) {
    return vec2(waves.x, waves.y);
  }

  return { gridHeight, pixelWaves, pixelSlope, syncTileSizes };
}
