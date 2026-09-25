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
  fwidth,
  length,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  positionWorld,
  screenSize,
  time,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { Color, type Node } from "three/webgpu";
import { shadeSea } from "./seascape-lighting";
import {
  seaElevation,
  seaSlopeLargeWaves,
  seaSlopeRipples,
  WAVES_AMPLITUDE,
  WAVES_SPEED,
} from "./seascape-waves";

/**
 * Default values of the surface's tunable uniforms. The single source for both
 * the shader and the Inspector panel, so the sea looks the same with the
 * Inspector on or off.
 */
export const SEASCAPE_SURFACE_DEFAULTS = {
  waveHeight: 1.0,
  /** Relative to the wave height; at 1 the ripples looked too weak. */
  ripples: 1.3,
  /** The Shadertoy used 0.65; raised for a more reflective sea. */
  reflectivity: 0.8,
  /**
   * The water's own colour, where it reflects no sky: a deep ocean blue, chosen
   * by eye in the Inspector. The Shadertoy's was a grey-green #597981.
   */
  deepColor: "#003b6b",
  /**
   * The tint crests and sunlit faces pick up: an aqua green, chosen by eye in
   * the Inspector. The Shadertoy's was a pale yellow-green #e7f3cc.
   */
  lightColor: "#42e6b5",
} as const;

type SurfaceOptions = {
  /** World units per unit of the shader's sea space. */
  scale: number;
  /** World Y of the sea's mean level. */
  levelY: number;
};

export function createSeascapeSurfaceNodes({ scale, levelY }: SurfaceOptions) {
  const seaTime = time.mul(WAVES_SPEED);

  /**
   * Live debugging knobs, driven by the Inspector's "Seascape" panel.
   *
   * Uniforms, so changing them does not rebuild the shader. Read only here, in
   * the stage entry points, never inside a Fn with a layout — see the rule at
   * the top of `seascape-waves.ts`.
   */
  const uniforms = {
    /** Scales the whole relief — the grid's lift and both slopes. 0 is flat. */
    waveHeight: uniform(SEASCAPE_SURFACE_DEFAULTS.waveHeight),
    /** Scales only the fine ripples computed per pixel. 0 hides that layer. */
    ripples: uniform(SEASCAPE_SURFACE_DEFAULTS.ripples),
    /** 1 fades octaves too fine for the pixel; 0 turns that off to compare. */
    antiAliasing: uniform(1.0),
    /** How much sky edge-on water reflects. */
    reflectivity: uniform(SEASCAPE_SURFACE_DEFAULTS.reflectivity),
    /** The water's own colour, where it reflects no sky. */
    deepColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.deepColor)),
    /** The tint crests and sunlit faces pick up. */
    lightColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.lightColor)),
  };

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
    // Scaled around the mean level, so waveHeight 0 leaves a flat sea in place
    const lift = vertexElevation.sub(WAVES_AMPLITUDE).mul(uniforms.waveHeight).mul(scale);

    return positionGeometry.add(vec3(0.0, lift, 0.0));
  })();

  /**
   * Slope of the large octaves, computed per vertex and handed to the
   * fragment shader, which receives it interpolated between the vertices.
   */
  const largeWavesSlope = varying(
    Fn(() => {
      const liftedVertex = vec3(
        vertexSea.x,
        vertexElevation.sub(WAVES_AMPLITUDE).mul(uniforms.waveHeight).add(WAVES_AMPLITUDE),
        vertexSea.z
      );
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

    // How much sea this pixel covers, in sea units: how fast the position
    // changes from one pixel to the next. Octaves finer than a few pixels are
    // faded out, which is what removes the moiré when zoomed out
    // (antiAliasing 0 reports a vanishing pixel, so nothing is ever faded.)
    const pixelSize = length(fwidth(point.xz)).mul(uniforms.antiAliasing);

    // Total slope = large waves (from the vertices) + fine ripples (per pixel)
    // Both scale with the relief; the ripples also have their own knob
    const ripplesSlope = seaSlopeRipples(point.xz, slopeStepFor(toPoint), seaTime, pixelSize);
    const slope = largeWavesSlope
      .add(ripplesSlope.mul(uniforms.ripples))
      .mul(uniforms.waveHeight);
    const normal = normalize(vec3(slope.x.negate(), 1.0, slope.y.negate()));

    return shadeSea(
      point,
      normal,
      viewDirection,
      toPoint,
      uniforms.reflectivity,
      uniforms.deepColor,
      uniforms.lightColor
    );
  })();

  return { positionNode, fragmentNode, uniforms };
}
