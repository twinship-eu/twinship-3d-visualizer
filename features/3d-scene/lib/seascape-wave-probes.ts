/**
 * Seascape — 12a. Wave probes
 *
 * The sea's height at a handful of points, for things on the CPU that ride
 * the waves — the ship. The FFT ocean lives on the GPU, so a compute pass
 * reads its cascades at the points and the heights are read back; the read
 * is asynchronous, so the values are a frame or two old, which a ship weighing
 * thousands of tonnes does not notice.
 */
import { Fn, instanceIndex, storage, texture, uniform, vec2, vec4 } from "three/tsl";
import { StorageBufferAttribute, type ComputeNode, type Node, type Renderer } from "three/webgpu";
import type { FftCascade } from "./seascape-fft-ocean";

/** A point to probe, in world x and z. */
export type ProbePoint = { x: number; z: number };

/**
 * @param toSea where a point of the scene is on the sea — see
 *   `seascape-sea-frame.ts`; the probes ride with the ship
 */
export function createWaveProbes(
  cascades: FftCascade[],
  points: ProbePoint[],
  toSea: (world: Node<"vec2">) => Node<"vec2">
) {
  const count = points.length;
  const positions = new StorageBufferAttribute(new Float32Array(count * 4), 4);
  const heights = new StorageBufferAttribute(new Float32Array(count * 4), 4);
  const positionsNode = storage(positions, "vec4", count);
  const heightsNode = storage(heights, "vec4", count);
  const layers = cascades.map((cascade) => ({ texture: texture(cascade.texture), tileSize: uniform(cascade.tileSize) }));

  /** Moves the probes, in world x and z: they follow what rides on them. */
  function setPoints(nextPoints: ProbePoint[]) {
    nextPoints.forEach((point, index) => {
      positions.array[index * 4] = point.x;
      positions.array[index * 4 + 1] = point.z;
    });
    positions.needsUpdate = true;
  }

  // The height at each probe: every cascade, unfiltered
  const probe: ComputeNode = Fn(() => {
    const point = toSea(positionsNode.element(instanceIndex).xy);
    let height: Node<"float"> = vec2(0.0).x;
    for (const layer of layers) {
      height = height.add(texture(layer.texture, point.div(layer.tileSize), 0).x);
    }
    heightsNode.element(instanceIndex).assign(vec4(height, 0.0, 0.0, 0.0));
  })().compute(count);

  let latest = new Float32Array(count);
  let isReading = false;

  /**
   * Probes the sea as it is now, and starts reading the result back. Returns
   * the latest heights that have arrived, in metres above the mean level.
   */
  function update(renderer: Renderer) {
    layers.forEach((layer, index) => {
      layer.tileSize.value = cascades[index].tileSize;
    });
    renderer.compute(probe);

    if (!isReading) {
      isReading = true;
      renderer
        .getArrayBufferAsync(heights)
        .then((buffer) => {
          const values = new Float32Array(buffer);
          latest = Float32Array.from({ length: count }, (_, index) => values[index * 4]);
        })
        .catch(() => {
          // A lost read (the page closing, the device lost) only skips a frame
        })
        .finally(() => {
          isReading = false;
        });
    }

    return latest;
  }

  setPoints(points);

  return { update, setPoints };
}
