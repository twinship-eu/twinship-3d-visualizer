import { SCENE_FOG_COLOR } from "./3d-scene-config";

/**
 * Which seascape the scene renders.
 *
 * - `false`: the screen-space raymarched background (`SceneSeascape`). Matches
 *   the original Shadertoy, but has its own fixed camera and no depth, so the
 *   ship can never sit in it.
 * - `true`: the same wave function on a real world-space grid
 *   (`SceneSeascapeSurface`). Experimental. The ship intersects the water
 *   properly and the sea follows the scene camera.
 */
export const IS_SEASCAPE_SURFACE_ENABLED = true;

/**
 * World units per unit of the shader's own sea space.
 *
 * The original shader's waves peak at about 1.5 of its units, seen from a
 * camera 3.5 above them. The ship is about 100 world units long, so the sea is
 * scaled up to give waves a few units high around it. This is the main knob for
 * how rough the sea looks next to the ship.
 */
export const SEASCAPE_SURFACE_SCALE = 4;

/**
 * World Y of the sea's reference level (the shader's `SEA_HEIGHT`).
 *
 * The same height the old water plane sat at, which `SHIP_VERTICAL_OFFSET` was
 * tuned against.
 */
export const SEASCAPE_SURFACE_LEVEL_Y = -5;

/** Side length of the displaced grid, in world units. */
export const SEASCAPE_SURFACE_GRID_SIZE = 1600;

/**
 * Grid segments per side: 5 world units between vertices.
 *
 * The geometry's finest octave has crests about 5.4 world units apart, so at
 * this density it gets barely one vertex per crest and the crest lines can look
 * faceted — straight segments with sharp kinks. Measured at 1080p:
 *   320 -> 205k triangles, ~3.0 ms, faceted crests   <- current
 *   640 -> 819k triangles, ~3.7 ms, smooth crests
 *   960 -> 1.8M triangles, ~4.6 ms, little further gain
 */
export const SEASCAPE_SURFACE_GRID_SEGMENTS = 320;

/**
 * Half the grid: the nearest the sea's edge ever gets to the camera, since the
 * grid is kept centred under it.
 */
const SEASCAPE_SURFACE_EDGE_DISTANCE = SEASCAPE_SURFACE_GRID_SIZE / 2;

/**
 * The haze and sky behind the surface sea — see `seascape-atmosphere-tsl.ts`.
 * Starting values; the Inspector's "Atmosphere" panel tunes them live.
 */
export const SEASCAPE_ATMOSPHERE = {
  /** The colour sea and sky both fade into. The scene's existing fog colour. */
  horizonColor: SCENE_FOG_COLOR,
  /** Where the haze starts. Past the ship at the widest zoom (400), barely. */
  hazeStart: 300,
  /** Where the haze is complete: short of the grid's edge, so the edge is never visible. */
  hazeEnd: SEASCAPE_SURFACE_EDGE_DISTANCE - 50,
  /** The sky is tinted by the haze up to this direction height (~9° above the horizon). */
  skyHazeHeight: 0.15,
  /** Largest haze end the panel allows — the grid's edge itself. */
  maxHazeEnd: SEASCAPE_SURFACE_EDGE_DISTANCE,
} as const;
