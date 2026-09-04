import { Color } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  color,
  Fn,
  mix,
  mx_worley_noise_float,
  oneMinus,
  positionGeometry,
  screenUV,
  time,
  uniform,
  vec2,
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
  return oneMinus(web).pow(CAUSTIC_SHARPNESS).mul(oneMinus(depthLevel));
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
  material.colorNode = water.add(light);
  material.opacityNode = opacity;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;

  return { material, uniforms: { depth, opacity } };
}
