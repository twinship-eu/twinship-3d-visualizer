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
  ambient: 2.3,
  sun: 10,
} as const;

export const SKY_SCALE = 10_000;

export const SKY_UNIFORMS = {
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  cloudCoverage: 0.4,
  cloudDensity: 0.5,
  cloudElevation: 0.5,
} as const;

/** Water plane size (XZ); match three.js ocean example scale. */
export const WATER_PLANE_SIZE = 10_000;
/** Water options from three.js ocean example. */
export const WATER_OPTIONS = {
  textureWidth: 512,
  textureHeight: 512,
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
} as const;
/** Water normals texture URL (three.js examples). Use local path if needed. */
export const WATER_NORMALS_URL =
  "https://threejs.org/examples/textures/waternormals.jpg";

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
