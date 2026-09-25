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

/** Grid densities the Inspector's Seascape panel offers, in segments per side. */
export const SEASCAPE_SURFACE_GRID_SEGMENT_OPTIONS = [160, 320, 480, 640, 960, 1280] as const;

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

/**
 * Foam mask textures for the crest foam: single-channel, 1 for foam and 0 for
 * water, tiling seamlessly. Made from two source images by cutting one tile,
 * blending out the seam at the wrap and stretching the contrast to 0..1:
 * - `lace`: thin strands with large holes (from the red channel, which the
 *   teal water in the source lacks);
 * - `bubbles`: denser, rounder foam cells.
 * The Inspector's Seascape panel switches between them.
 */
export const SEASCAPE_FOAM_TEXTURES = {
  lace: "/textures/foam-lace.png",
  bubbles: "/textures/foam-bubbles.png",
} as const;

export type SeascapeFoamTextureName = keyof typeof SEASCAPE_FOAM_TEXTURES;

export const SEASCAPE_DEFAULT_FOAM_TEXTURE: SeascapeFoamTextureName = "lace";

/** Anisotropic filtering for the foam: keeps it sharp on water seen at a grazing angle. */
export const SEASCAPE_FOAM_ANISOTROPY = 8;

/**
 * The wind the surface sea starts with — the only thing driving its waves (see
 * `seascape-wind-waves.ts`). The Inspector's Seascape panel changes it live.
 *
 * 10 m/s over 100 km of open water: a fresh breeze, Beaufort 5, which raises
 * Hs ≈ 2 m with a 6 s peak period and 57 m peak wavelength. From 225° (south-
 * west, with 0 = +Z as for the sun), so the waves roll towards the default
 * camera.
 */
export const SEASCAPE_WIND = {
  speed: 10,
  fromDegrees: 225,
  fetch: 100_000,
} as const;

/** Limits of the Inspector's wind sliders. 35 m/s is a hurricane, Beaufort 12. */
export const SEASCAPE_WIND_LIMITS = {
  maxSpeed: 35,
  minFetch: 1_000,
  maxFetch: 1_000_000,
} as const;

/**
 * The short chop's normal map, generated for the sea rather than borrowed:
 * random ripples with no preferred direction, built from a spectrum so it
 * tiles perfectly, stored losslessly. It replaced three's `waternormals.jpg`,
 * whose ripples all lean one way — about 3x more slope at 45-75° than at
 * 120-135° — and which drew stripes across the sea. The same slope (0.24 rms),
 * so the wind's strengths carry over. Made with numpy: slope spectrum flat from
 * 6 to 60 cycles per tile (median 16), every component the same strength with a
 * random phase. Starting at 3 cycles, its largest ripples reflected the sky in
 * big white patches.
 */
export const SEASCAPE_CHOP_NORMALS_URL = "/textures/sea-chop-normals.png";

/**
 * Anisotropic filtering for the chop's normal map: none. At 8, as for the
 * foam, it drew thin bright streaks running away from the camera, and a line
 * where they bunched up; filtering a normal map anisotropically is known to do
 * that. Without it the chop is softer at grazing angles, where it is fading
 * out anyway.
 */
export const SEASCAPE_DETAIL_NORMALS_ANISOTROPY = 1;
