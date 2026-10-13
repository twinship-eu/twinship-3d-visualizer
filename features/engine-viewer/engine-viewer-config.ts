import { ENGINE_SHIP_MODEL_KTX2_GLB } from "@/features/ship-visualizer/ship-visualizer-config";

/**
 * The engine has no GLB of its own: it is the `Engine` node of the full ship
 * model, so this loads the ship and keeps only that node.
 */
export const ENGINE_MODEL_PATH = ENGINE_SHIP_MODEL_KTX2_GLB;

/** Name of the node, in the ship model, that holds the engine. */
export const ENGINE_NODE_NAME = "Engine";

/** Background behind the engine: darker than the sea scene, so the metal reads. */
export const ENGINE_BACKGROUND_COLOR = "#1a1f27";

/**
 * Camera framing, as multiples of the engine's bounding-sphere radius, so it
 * holds for any model scale.
 */
export const ENGINE_CAMERA = {
  /** Starting distance from the engine's centre. */
  START_DISTANCE: 2.6,
  /** Closest the camera may get: right up against a component. */
  MIN_DISTANCE: 0.15,
  /** Furthest the camera may get. */
  MAX_DISTANCE: 8,
  /** Near plane; small enough not to clip when zoomed in close. */
  NEAR: 0.005,
  /** Far plane; just past the furthest zoom. */
  FAR: 20,
  /** Where the camera starts, as a direction from the centre (normalised at use). */
  START_DIRECTION: [0.8, 0.5, 1],
  FOV: 40,
  DAMPING_FACTOR: 0.06,
} as const;

/** Lights, as intensities. The sky probe does most of the work on desktop. */
export const ENGINE_LIGHTS = {
  KEY: 1.5,
  FILL: 0.5,
  /** Faint flat fill, so no face goes fully black. Phones use the ship scene's stronger set instead. */
  AMBIENT: 0.15,
  /**
   * Substitute for the sky probe on the devices that skip it (`?forceNoEnv`
   * previews it on desktop). Softer than the ship scene's: the engine's paint is
   * light grey and indoors-lit, where the ship's set washes it out to white.
   */
  NO_PROBE_AMBIENT: 0.8,
  NO_PROBE_HEMISPHERE: 2,
  /** Key light position, as multiples of the engine radius. */
  KEY_POSITION: [2, 3, 2],
  /** Fill light position, opposite the key. */
  FILL_POSITION: [-2, 1, -2],
} as const;

/** Canvas pixel ratio cap. */
export const ENGINE_MAX_PIXEL_RATIO = 2;
