import { Color } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  abs,
  atan,
  color,
  float,
  Fn,
  hash,
  Loop,
  mix,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  oneMinus,
  positionGeometry,
  screenUV,
  sin,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

/**
 * Colours are authored to be seen *through* the scene's ACES tone mapping at
 * exposure 0.3, because the veil is deliberately left tone-mapped: it dissolves
 * into a tone-mapped scene, and turning it off would show a contrast jump at the
 * handoff. Expect these to look brighter in a colour picker than on screen.
 */
const ABYSS_COLOR = new Color("#04101c");
const SURFACE_COLOR = new Color("#2f9ec4");
/** Accent borrowed from SELECTED_PART_COLOR so the effect belongs to this app. */
const CAUSTIC_COLOR = new Color("#b69cff");

const CAUSTIC_SCALE = 16;
const CAUSTIC_SCALE_RATIO = 1.35;
const CAUSTIC_DRIFT = 0.06;
const CAUSTIC_SHARPNESS = 9;
/** Caustics are an overlay, not the subject; at full strength they swamp the rays. */
const CAUSTIC_STRENGTH = 0.45;

/**
 * `uniform(1)` resolves to `UniformNode<"float", number>`, which three does not
 * export under a name, so the type is derived from a call instead.
 */
function floatUniform(value: number) {
  return uniform(value);
}

type FloatUniform = ReturnType<typeof floatUniform>;

export type DepthVeilUniforms = {
  depth: FloatUniform;
  opacity: FloatUniform;
};

/**
 * Two counter-scrolling Worley layers, differenced and sharpened, give the
 * bright interlocking web that reads as caustic light. Contrast rises as depth
 * falls, so the abyss is nearly flat and the surface is dazzling.
 */
const caustics = Fn(([depthLevel]: [FloatUniform]) => {
  const drift = time.mul(CAUSTIC_DRIFT);
  const uvA = screenUV.mul(CAUSTIC_SCALE).add(vec2(drift, drift.mul(0.6)));
  const uvB = screenUV
    .mul(CAUSTIC_SCALE * CAUSTIC_SCALE_RATIO)
    .sub(vec2(drift.mul(0.8), drift.mul(0.35)));
  const web = mx_worley_noise_float(uvA).sub(mx_worley_noise_float(uvB)).abs();
  return oneMinus(web)
    .pow(CAUSTIC_SHARPNESS)
    .mul(oneMinus(depthLevel))
    .mul(CAUSTIC_STRENGTH);
});

/**
 * Vertical ramp from abyss to surface, re-mapped by depth so rising reads as
 * rising. `screenUV.y` increases downward, so it is flipped here: the surface
 * belongs at the top of the frame.
 */
const abyssGradient = Fn(([depthLevel]: [FloatUniform]) => {
  const height = oneMinus(screenUV.y)
    .mul(0.5)
    .add(oneMinus(depthLevel).mul(0.5));
  return mix(color(ABYSS_COLOR), color(SURFACE_COLOR), height.clamp(0, 1));
});

const RAY_COUNT = 7;
const RAY_SAMPLES = 4;
const RAY_SOFTNESS = 2.5;
const RAY_NOISE_SCALE = 1.7;
const RAY_DRIFT = 0.05;
const SUN_SCREEN_X = 0.5;
/** Averaging over samples leaves the shafts far too faint without this. */
const RAY_STRENGTH = 2.6;

/**
 * Shafts of light fanning from a point above the surface. Angular bands broken
 * up by fractal noise and accumulated over a few samples along the view ray.
 * `mx_fractal_noise_float` takes a vec3, unlike the Worley call above.
 */
const godRays = Fn(([depthLevel]: [FloatUniform]) => {
  // screenUV.y runs downward, so the sun sits at y = 0.
  const toSun = screenUV.sub(vec2(SUN_SCREEN_X, 0));
  const angle = atan(toSun.x, toSun.y);
  const accumulated = float(0).toVar();

  Loop({ start: 0, end: RAY_SAMPLES }, ({ i }) => {
    const offset = float(i).div(RAY_SAMPLES).mul(0.35);
    const bands = abs(sin(angle.mul(RAY_COUNT).add(offset)));
    const shaped = oneMinus(bands).pow(RAY_SOFTNESS);
    const broken = mx_fractal_noise_float(
      vec3(angle.mul(RAY_NOISE_SCALE), time.mul(RAY_DRIFT), offset),
      3,
      2,
      0.5,
      1
    )
      .mul(0.5)
      .add(0.5);
    accumulated.addAssign(shaped.mul(broken));
  });

  // Rays are strongest just under the surface and vanish in the abyss.
  const reach = oneMinus(depthLevel).pow(1.5);
  return accumulated.div(RAY_SAMPLES).mul(reach).mul(RAY_STRENGTH);
});

const MOTE_SCALE = 40;
const MOTE_RISE = 0.03;
const MOTE_DENSITY = 0.985;
const MOTE_BRIGHTNESS = 0.5;
/** Fraction of a cell the mote fills. Lighting the whole cell gives squares. */
const MOTE_RADIUS = 0.16;
/** Arbitrary co-prime-ish stride, so cells in a row do not share a hash. */
const MOTE_ROW_STRIDE = 57;

/**
 * Sparse particulate drifting upward past the camera. One hash per cell picks
 * which cells carry a mote, and a soft radial falloff inside the cell keeps them
 * round — thresholding the cell alone renders visible squares.
 *
 * The offset is added to y, not subtracted: with `screenUV.y` running downward,
 * sampling further down the pattern over time makes it travel up the screen.
 */
const motes = Fn(([depthLevel]: [FloatUniform]) => {
  const grid = screenUV.add(vec2(0, time.mul(MOTE_RISE))).mul(MOTE_SCALE);
  const cell = grid.floor();
  const local = grid.fract().sub(0.5);
  const speck = hash(cell.x.add(cell.y.mul(MOTE_ROW_STRIDE)));
  const dot = oneMinus(smoothstep(0, MOTE_RADIUS, local.length()));
  const lit = speck.greaterThan(MOTE_DENSITY).select(dot, float(0));
  // Denser in the murk, sparse in clear water near the surface.
  return lit.mul(MOTE_BRIGHTNESS).mul(depthLevel.mul(0.7).add(0.3));
});

const HULL_WIDTH = 0.38;
const HULL_HEIGHT = 0.055;
const HULL_CENTER_X = 0.5;
/** Near the top of the frame, because screenUV.y runs downward. */
const HULL_SURFACE_Y = 0.07;
const HULL_BOB_AMPLITUDE = 0.012;
const HULL_BOB_RATE = 0.35;
const HULL_EDGE_SOFTNESS = 0.04;
const HULL_OCCLUSION = 0.85;

/**
 * An elongated hull profile occluding the surface light, bobbing gently.
 * Deliberately abstract: the real ship is what is still downloading.
 */
const hullSilhouette = Fn(([depthLevel]: [FloatUniform]) => {
  const bob = sin(time.mul(HULL_BOB_RATE)).mul(HULL_BOB_AMPLITUDE);
  const centered = screenUV.sub(
    vec2(HULL_CENTER_X, float(HULL_SURFACE_Y).add(bob))
  );
  // Superellipse: flatter flanks than a true ellipse, so it reads as a hull.
  const profile = centered.x
    .div(HULL_WIDTH)
    .abs()
    .pow(4)
    .add(centered.y.div(HULL_HEIGHT).abs().pow(2));
  const inside = oneMinus(
    smoothstep(1 - HULL_EDGE_SOFTNESS, 1 + HULL_EDGE_SOFTNESS, profile)
  );
  // Only visible once close enough to the surface to be silhouetted against it.
  return inside.mul(oneMinus(depthLevel).pow(0.6));
});

const SURFACE_FLASH_STRENGTH = 1.6;

/** Exposure lifts as the surface is broken, covering the handoff to the scene. */
const surfaceBreak = Fn(([depthLevel]: [FloatUniform]) =>
  oneMinus(smoothstep(0, 0.25, depthLevel)).mul(SURFACE_FLASH_STRENGTH).add(1)
);

/**
 * Builds the veil material. `depth` runs 1 (abyss) -> 0 (surface); `opacity`
 * drives the dissolve. Everything else comes from `time` and `screenUV`, so a
 * frame costs two scalar uniform writes and never invalidates the pipeline.
 */
export function createDepthVeilMaterial(): {
  material: MeshBasicNodeMaterial;
  uniforms: DepthVeilUniforms;
} {
  const depth = floatUniform(1);
  const opacity = floatUniform(1);

  const water = abyssGradient(depth);
  const light = caustics(depth).mul(color(CAUSTIC_COLOR));

  const material = new MeshBasicNodeMaterial();
  // A 2x2 plane's positions are already clip-space, so writing them straight to
  // the vertex output covers the viewport regardless of where the camera is.
  material.vertexNode = vec4(positionGeometry.xy, 0, 1);
  const rays = godRays(depth).mul(color(SURFACE_COLOR));
  const dust = motes(depth).mul(color(SURFACE_COLOR));
  // The silhouette subtracts light rather than adding colour, so it reads as an
  // occluder against the surface rather than a dark sprite in the water.
  const shade = oneMinus(hullSilhouette(depth).mul(HULL_OCCLUSION));

  material.colorNode = water
    .add(light)
    .add(rays)
    .add(dust)
    .mul(shade)
    .mul(surfaceBreak(depth));
  material.opacityNode = opacity;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;

  return { material, uniforms: { depth, opacity } };
}
