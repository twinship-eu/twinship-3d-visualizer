/**
 * Seascape — 4b. World-space surface
 *
 * The same sea as the raymarched background, but as real geometry: a flat
 * grid lifted by the wave height. Because it is geometry, it has depth — the
 * ship's hull goes under the surface — and it is seen through the scene's
 * real camera.
 *
 * What changes compared with the raymarch:
 * - No tracing. The rasteriser already knows where each pixel meets the sea.
 * - The view ray goes from the scene camera to the pixel, not from an
 *   imaginary camera.
 *
 * Performance: the normal needs the slope of all 5 octaves — 3 height samples
 * x 5 octaves x 2 wave trains = 30 wave evaluations per pixel if done naively.
 * The slope of a sum is the sum of the slopes, so it is split:
 * - the largest, smoothest octave (`seaSlopeLargeWaves`) is computed per
 *   vertex and interpolated between vertices;
 * - the other 4 octaves (`seaSlopeRipples`) are computed per pixel.
 * That is 24 wave evaluations per pixel instead of 30, about 26% less GPU time
 * with no visible difference. The measurements behind where the split sits are
 * at `LARGE_WAVE_OCTAVES`.
 */
import {
  cameraPosition,
  dot,
  float,
  Fn,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  positionWorld,
  screenSize,
  time,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { shadeSea } from "./seascape-lighting";
import {
  seaElevation,
  seaSlopeLargeWaves,
  seaSlopeRipples,
  WAVES_AMPLITUDE,
  WAVES_SPEED,
} from "./seascape-waves";

type SurfaceOptions = {
  /** World units per unit of the shader's sea space. */
  scale: number;
  /** World Y of the sea's mean level. */
  levelY: number;
};

export function createSeascapeSurfaceNodes({ scale, levelY }: SurfaceOptions) {
  const seaTime = time.mul(WAVES_SPEED);

  /**
   * World space -> the shader's sea space: scaled down, with the sea's mean
   * level at the height the wave maths expects (`WAVES_AMPLITUDE`).
   */
  const toSeaSpace = (world: Node<"vec3">) =>
    vec3(
      world.x.div(scale),
      world.y.sub(levelY).div(scale).add(WAVES_AMPLITUDE),
      world.z.div(scale)
    );

  /**
   * Distance over which to measure the slope: grows with the square of the
   * distance from the camera, so far water is averaged and stays calm. (The
   * GLSL EPSILON_NRM.)
   */
  const slopeStepFor = (toPoint: Node<"vec3">) =>
    dot(toPoint, toPoint).mul(float(0.1).div(screenSize.x));

  // Where this grid vertex is, in sea space, before it is lifted
  const vertexWorld = modelWorldMatrix.mul(vec4(positionGeometry, 1.0)).xyz;
  const vertexSea = toSeaSpace(vertexWorld);
  const vertexElevation = seaElevation(vertexSea.xz, seaTime);

  /**
   * Vertex: lift the grid to the sea's height.
   *
   * Uses the world position rather than the local one, so the waves stay put
   * in the world while the grid follows the camera around.
   */
  const positionNode = Fn(() => {
    const lift = vertexElevation.sub(WAVES_AMPLITUDE).mul(scale);

    return positionGeometry.add(vec3(0.0, lift, 0.0));
  })();

  /**
   * Slope of the large octaves, computed per vertex and handed to the
   * fragment shader, which receives it interpolated between the vertices.
   */
  const largeWavesSlope = varying(
    Fn(() => {
      const liftedVertex = vec3(vertexSea.x, vertexElevation, vertexSea.z);
      const toVertex = liftedVertex.sub(toSeaSpace(cameraPosition));

      return seaSlopeLargeWaves(vertexSea.xz, slopeStepFor(toVertex), seaTime);
    })(),
    "vLargeWavesSlope"
  );

  /**
   * Fragment: the fine ripples' slope, the normal, and the shading.
   */
  const fragmentNode = Fn(() => {
    const point = toSeaSpace(positionWorld);
    const toPoint = point.sub(toSeaSpace(cameraPosition));
    const viewDirection = normalize(toPoint);

    // Total slope = large waves (from the vertices) + fine ripples (per pixel)
    const ripplesSlope = seaSlopeRipples(point.xz, slopeStepFor(toPoint), seaTime);
    const slope = largeWavesSlope.add(ripplesSlope);
    const normal = normalize(vec3(slope.x.negate(), 1.0, slope.y.negate()));

    return shadeSea(point, normal, viewDirection, toPoint);
  })();

  return { positionNode, fragmentNode };
}
