import { MathUtils, Vector3 } from "three";

const DEFAULT_SCENE_SCALE = 1;

const SUN_ELEVATION_DEG = 60;
const SUN_AZIMUTH_DEG = 180;


export function getSunDirection(): Vector3 {
  const phi = MathUtils.degToRad(90 - SUN_ELEVATION_DEG);
  const theta = MathUtils.degToRad(SUN_AZIMUTH_DEG);
  return new Vector3().setFromSphericalCoords(1, phi, theta);
}

export const SUN_DISTANCE = 450_000;

export function getSunPosition(): Vector3 {
  return getSunDirection().multiplyScalar(SUN_DISTANCE);
}

export const LIGHT_INTENSITY = {
  ambient: 0.25,
  sun: 7,
} as const;

/**
 * Strength of the sky-baked IBL probe that lights the ship's metallic
 * materials. Raise for shinier metal, lower for a flatter look.
 */
export const ENVIRONMENT_MAP_INTENSITY = 0.35;

export const SKY_SCALE = 10_000;

export const SKY_UNIFORMS = {
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  cloudCoverage: 0.4,
  cloudDensity: 0.5,
  cloudElevation: 0.5,
  /** Spatial frequency of the cloud noise. Larger = smaller, busier clouds. */
  cloudScale: 0.0002,
  /**
   * Cloud drift rate. SkyMesh advances clouds from TSL's global `time`, which
   * replaces the manual per-frame clock the GLSL Sky needed.
   */
  cloudSpeed: 0.0001,
} as const;

/** Water plane size (XZ); match three.js ocean example scale. */
export const WATER_PLANE_SIZE = 10_000;
/** Water options from three.js ocean example. */
export const WATER_OPTIONS = {
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
} as const;

/**
 * Reflection render-target scale for the water. WaterMesh replaces the old
 * textureWidth/textureHeight pair (512x512) with this single factor; 0.5 is its
 * default and the closest match at typical viewport sizes.
 */
export const WATER_RESOLUTION_SCALE = 0.5;
/** Water normals texture URL (three.js examples). Use local path if needed. */
export const WATER_NORMALS_URL =
  "https://threejs.org/examples/textures/waternormals.jpg";

/**
 * Timing for the loading ring. Read by both the phase machine and the component
 * that interpolates toward its targets, so it lives here rather than in either.
 */
export const LOADING_RING_TIMING = {
  /**
   * One sweep of the arc. The fill repeats in whole cycles and the handover only
   * ever happens at a cycle boundary, so the transition always looks deliberate
   * — which also means the arc is an indeterminate animation, not a progress
   * meter: tracking real percent would stall mid-sweep and never reach a
   * boundary to hand over on.
   *
   * These are the defaults; the live values live in LOADING_RING_PREVIEW so the
   * development GUI can tune them, and nothing writes them in production.
   */
  FILL_MS: 1500,
  /** Particles flying from the ring onto their sampled points on the hull. */
  CONVERGE_MS: 1600,
  /** The assembled "ghost ship" holding still, so the shape registers. */
  HOLD_MS: 100,
  /** Particles fading out over the newly revealed ship. */
  REVEAL_MS: 700,
  /** Exponential smoothing rate for progress and dispersion, per second. */
  SMOOTHING_RATE: 6,
} as const;

/**
 * Height of the loading ring. Sits at roughly the ship's own waterline, so the
 * particles start where the hull will be rather than below it.
 */
export const RING_WATERLINE_Y = 0.5;

/**
 * three's built-in Inspector, which hosts the loading-ring controls and its own
 * performance and console tabs. Development only: it injects a panel beside the
 * canvas, and enables GPU timestamp queries.
 */
export const IS_SCENE_INSPECTOR_ENABLED =
  process.env.NODE_ENV === "development";

/** The backend readout is a development diagnostic, not product UI. */
export const IS_RENDERER_BADGE_ENABLED = process.env.NODE_ENV === "development";

export const SCENE_BACKGROUND_COLOR = "#c8d4e0";

export const SCENE_FOG_COLOR = "#c8d4e0";

export const FOG_NEAR = 40;
export const FOG_FAR = 420;

export const GRID_FADE_DISTANCE = 120;
export const GRID_FADE_STRENGTH = 1.2;

export const GRID_CELL_SIZE = 2;
export const GRID_SECTION_SIZE = 10;

export const GROUND_PLANE_COLOR = "#53389e";

export const GROUND_PLANE_OPACITY = 0.4;

export const GRID_CELL_COLOR = "#ffffff";
export const GRID_SECTION_COLOR = "#ffffff";

export const GRID_PLANE_SIZE = 800;

export type SceneScaleConfig = {
  fogNear: number;
  fogFar: number;
  gridFadeDistance: number;
  gridCellSize: number;
  gridSectionSize: number;
  gridPlaneSize: number;
};

export function getSceneScaleConfig(scale: number = DEFAULT_SCENE_SCALE): SceneScaleConfig {
  return {
    fogNear: FOG_NEAR * scale,
    fogFar: FOG_FAR * scale,
    gridFadeDistance: GRID_FADE_DISTANCE * scale,
    gridCellSize: GRID_CELL_SIZE * scale,
    gridSectionSize: GRID_SECTION_SIZE * scale,
    gridPlaneSize: GRID_PLANE_SIZE * scale,
  };
}
