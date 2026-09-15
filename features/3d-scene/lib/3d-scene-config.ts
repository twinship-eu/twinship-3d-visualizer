import { MathUtils, Vector3 } from "three";

const DEFAULT_SCENE_SCALE = 1;

/**
 * Sun elevation above the horizon. Drives shadow length directly: a point `h`
 * above the water casts a shadow `h / tan(elevation)` long, so 35 degrees gives
 * shadows ~1.4x the caster's height where 60 degrees gave ~0.6x.
 */
const SUN_ELEVATION_DEG = 35;

/**
 * Sun compass bearing. The stern is at -Z (the propellers sit at Z -98..-91),
 * so bearings below 270 swing the sun aft.
 *
 * 205 puts it off the port quarter, well aft. Chosen so the wind-turbine
 * towers' shadows land on the deck rather than over the side: the towers stand
 * 11.6 units above a deck 7.8 units to a side, so at this elevation their
 * shadow is 11.6 / tan(35) = 16.6 units long, and its sideways component is
 * that times |sin(azimuth)|. Staying on deck needs |sin| below 7.8 / 16.6 =
 * 0.47, so within 28 degrees of 180; at 205 it is 7.0 units.
 *
 * Drives the visible sun and the water's specular highlight too, via
 * `getSunDirection`, so the shading stays consistent with the shadows.
 */
const SUN_AZIMUTH_DEG = 205;

export function getSunDirection(): Vector3 {
  const phi = MathUtils.degToRad(90 - SUN_ELEVATION_DEG);
  const theta = MathUtils.degToRad(SUN_AZIMUTH_DEG);
  return new Vector3().setFromSphericalCoords(1, phi, theta);
}

/**
 * Distance at which the sun's directional light is placed.
 *
 * A directional light's position does not affect shading at all — only the
 * direction from its position to its target does — but it *does* place the
 * shadow camera, whose near and far planes are measured from the light. This
 * previously sat at an astronomical 450,000 units while the shadow camera's far
 * plane was 200, so the camera saw a slab 200 units deep starting 450,000 units
 * from the ship. The shadow map rendered empty every frame, which is why the
 * ship has never cast a shadow despite everything being switched on.
 *
 * Keeping the light on the same ray preserves the lighting angle exactly.
 */
export const SHADOW_LIGHT_DISTANCE = 150;

export function getShadowLightPosition(): Vector3 {
  return getSunDirection().multiplyScalar(SHADOW_LIGHT_DISTANCE);
}

/**
 * Orthographic half-extent of the shadow camera, in world units.
 *
 * The ship's bounding radius is ~55 units, and at this sun elevation its shadow
 * reaches ~65, so 70 covers both with little waste. Slack costs resolution
 * directly: the map holds SHADOW_CAMERA_EXTENT * 2 units across
 * SHADOW_MAP_SIZE texels, so 70 gives ~0.07 units per texel where the previous
 * 200 gave ~0.20.
 */
export const SHADOW_CAMERA_EXTENT = 70;

export const SHADOW_MAP_SIZE = 2048;

/**
 * Depth range the shadow camera sees, measured from the light. Brackets the
 * ship's extent along the light direction, with margin for it rising out of the
 * water during part inspection.
 */
export const SHADOW_CAMERA_NEAR = 50;
export const SHADOW_CAMERA_FAR = 260;

/**
 * Offsets the shadow lookup along the surface normal, to stop a surface
 * shadowing itself through depth-buffer quantisation. Preferred over a plain
 * depth bias, which at this texel size detaches the shadow from the hull.
 */
export const SHADOW_NORMAL_BIAS = 0.05;

/**
 * Scene lighting.
 *
 * On desktop and iOS the sun is paired with the sky PMREM probe: the ship is
 * almost entirely metal — 0.93 to 1.00 metalness across the hull, deck and
 * towers — and metal has no diffuse response, so ambient / hemisphere fills
 * never reached those surfaces. What lights the hull there is the probe it
 * reflects, scaled by ENVIRONMENT_MAP_INTENSITY.
 *
 * On Android the probe is not assigned (see `canAssignEnvironmentProbe`), so a
 * weak hemisphere fill comes back as a substitute for the missing sky light.
 * It cannot restore metallic reflections; it only keeps the diffuse remainder
 * of the materials from sitting in pure sun/shadow.
 *
 * Desktop can preview that path with `?forceNoEnv` and tune the hemisphere
 * from the Inspector's Lights panel before copying values back here.
 */
export const LIGHT_INTENSITY = {
  /** Direct sun, and the only light the shadows block. */
  sun: 4,
  /**
   * Hemisphere fill used only when the environment probe is skipped (Android).
   * Tuned against the Pixel `env OFF` readout: enough to lift shadowed paint
   * without washing out the sun side.
   */
  androidHemisphere: 0.85,
} as const;

/** Sky colour of the Android-only hemisphere fill. */
export const ANDROID_HEMISPHERE_SKY_COLOR = "#8ec7ff";

/** Ground colour of the Android-only hemisphere fill. */
export const ANDROID_HEMISPHERE_GROUND_COLOR = "#3a4a3c";

/**
 * Strength of the sky-baked IBL probe that lights the ship's metallic
 * materials. Raise for shinier metal, lower for a flatter look.
 */
export const ENVIRONMENT_MAP_INTENSITY = 0.35;

/**
 * Whether the baked sky probe lights the ship at all.
 *
 * Off means the hull is lit purely by the ambient, hemisphere and directional
 * lights, and its metal reflects nothing — flatter and darker, but fully under
 * the control of the three light intensities. On, the sky also contributes,
 * which is what gives metal something to reflect.
 *
 * The probe is baked either way, so the Inspector's Lights panel can switch
 * this live; the bake is a one-off at startup and cheap to leave in place.
 *
 * **Do not remove the probe to turn it off. Set this to `false`.**
 */
export const IS_ENVIRONMENT_LIGHTING_ENABLED = true;

/**
 * Sky overrides used only when baking the environment probe.
 *
 * The probe is rendered from the same sky the camera sees, which includes the
 * sun's disc and halo — so every metal surface on the ship picked up a bright
 * hot spot from it, on top of the directional light already representing that
 * same sun. The hull was effectively lit by the sun twice.
 *
 * Mie scattering is what draws the sun's glare in this sky model, so flattening
 * it for the bake keeps the sky's colour and its bright-above/dark-below
 * gradient — which is what the probe is for — while dropping the hot spot.
 *
 * The visible sky is untouched; only the probe uses these.
 */
export const ENVIRONMENT_SKY_OVERRIDES = {
  mieCoefficient: 0.0005,
  mieDirectionalG: 0.05,
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
 * Whether the water renders true planar reflections.
 *
 * `WaterMesh` reflects by re-rendering the entire scene from a mirrored camera
 * into a second target, so the whole ship is rasterised twice per frame — the
 * `Scene [ Reflector ]` entry in the Inspector's GPU breakdown, and confirmed by
 * the triangle counter reading almost exactly twice the model's own count.
 *
 * Set to `false` to swap in a flat, environment-lit water surface that keeps
 * the plane and its colour but drops the second scene pass. The reflection is
 * visibly lost, so this is a performance trade, not a free win.
 *
 * Measured, and worth not re-testing: switching this off did **not** fix the
 * slowdown when orbiting close to the engine. The second pass is real cost but
 * was not the bottleneck — the engine node's triangle count was.
 *
 * **Do not delete the reflective path to turn it off. Set this to `false`.**
 */
export const IS_WATER_REFLECTION_ENABLED = true;

/**
 * Reflection render-target scale for the water. WaterMesh replaces the old
 * textureWidth/textureHeight pair (512x512) with this single factor; 0.5 is its
 * default and the closest match at typical viewport sizes.
 */
export const WATER_RESOLUTION_SCALE = 0.5;
/**
 * Water normals texture, served from our own public/ directory.
 *
 * Vendored from the three.js examples (MIT) rather than hot-linked: loading it
 * from threejs.org made the scene fail with no internet connection, and left a
 * third party's docs site in the runtime path of our app.
 */
export const WATER_NORMALS_URL = "/textures/waternormals.jpg";

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
} as const;

/**
 * Height of the loading ring. Sits at roughly the ship's own waterline, so the
 * particles start where the hull will be rather than below it.
 */
export const RING_WATERLINE_Y = 0.5;

/**
 * three's built-in Inspector: frame timing, draw calls, compute passes, memory
 * and a console, in a panel beside the canvas. Development only — it also
 * enables GPU timestamp queries, which cost something to collect.
 *
 * **Do not delete the Inspector wiring to turn it off. Set this to `false`.**
 * It was deleted once (b8cd4d4) and had to be reconstructed from that commit;
 * the wiring is small but carries two non-obvious details that are expensive to
 * rediscover — the pre-`init()` attach in `webgpu-renderer.ts`, and the
 * `:root:root` override in `globals.css` that stops the Inspector's stylesheet
 * repainting the app's text.
 */
export const IS_SCENE_INSPECTOR_ENABLED = process.env.NODE_ENV === "development";

/** The backend readout is a development diagnostic, not product UI. */
export const IS_RENDERER_BADGE_ENABLED = process.env.NODE_ENV === "development";

/**
 * Per-frame draw call and triangle counts, which the Inspector does not
 * report. Development only.
 *
 * **Do not delete the wiring to turn this off. Set this to `false`.**
 */
export const IS_SCENE_STATS_ENABLED = process.env.NODE_ENV === "development";

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
