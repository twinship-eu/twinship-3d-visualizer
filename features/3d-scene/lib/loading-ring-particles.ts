import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
} from "three";
import { AdditiveBlending, SpriteNodeMaterial } from "three/webgpu";
import {
  abs,
  attribute,
  color,
  cos,
  float,
  fract,
  length,
  mix,
  normalize,
  oneMinus,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";

const TAU = Math.PI * 2;

/** Particle count is baked into the geometry, so it is the one thing the GUI cannot change live. */
const PARTICLE_COUNT = 2400;

/** Dim particles outside the completed arc; hot ones inside it. */
const RING_DIM_COLOR = new Color("#3f6f8f");
const RING_HOT_COLOR = new Color("#b69cff");

/** How far particles fly out, and how far they lift, as the ring bursts. */
const DISPERSE_DISTANCE = 26;
const DISPERSE_LIFT = 14;
/** Extra brightness and size right at the arc's leading edge. */
const EDGE_BOOST = 2.2;
const EDGE_SIZE_BOOST = 0.9;
/** Vertical breathing of the ring band, as a fraction of radius. */
const WOBBLE_RATE = 0.7;
/** Alpha floor, so unfilled ring is still visible rather than invisible. */
const BASE_OPACITY = 0.22;
/** Point sprites are square; this trims them to a soft disc. */
const SPRITE_EDGE = 0.5;
const SPRITE_CORE = 0.32;

function floatUniform(value: number) {
  return uniform(value);
}

type FloatUniform = ReturnType<typeof floatUniform>;

/**
 * Dev-only tuning override.
 *
 * `progress` and `dispersion` are written every frame by the component, so a
 * GUI slider bound straight to those uniforms would be overwritten before it
 * could be seen. Pinning here makes the interpolation follow these values
 * instead, which is what allows the fill and the burst to be held still and
 * inspected. Plain mutable state on purpose: the GUI writes it outside React,
 * and nothing should re-render when it changes.
 */
export type LoadingRingOverride = {
  /** Replay the whole fill-then-burst cycle forever, for looking at it. */
  isLooping: boolean;
  /** Seconds for one full loop, fill plus burst. */
  loopSeconds: number;
  /** Freeze the ring at the `progress` and `dispersion` below. */
  isPinned: boolean;
  progress: number;
  dispersion: number;
};

export type LoadingRingUniforms = {
  /** 0 -> 1 as the model loads. Drives how far the bright arc has swept. */
  progress: FloatUniform;
  /** 0 = intact ring, 1 = fully burst and faded. */
  dispersion: FloatUniform;
  radius: FloatUniform;
  tilt: FloatUniform;
  spinSpeed: FloatUniform;
  /** Sprite size in world units — not pixels; scaleNode is a world-space scale. */
  spriteSize: FloatUniform;
  glow: FloatUniform;
  arcSoftness: FloatUniform;
  bandThickness: FloatUniform;
};

/**
 * One instanced quad per particle.
 *
 * Deliberately not `Points`: the only way to round off a point sprite is
 * `pointUV`, whose node generates the literal GLSL `gl_PointCoord`, so it cannot
 * compile on WebGPU at all — it invalidates the whole render pipeline. An
 * instanced quad carries a real `uv` attribute, which works on both backends.
 */
function createRingGeometry(): InstancedBufferGeometry {
  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  geometry.instanceCount = PARTICLE_COUNT;

  const angles = new Float32Array(PARTICLE_COUNT);
  const jitters = new Float32Array(PARTICLE_COUNT);
  const speeds = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    angles[i] = Math.random() * TAU;
    jitters[i] = Math.random() * 2 - 1;
    speeds[i] = 0.8 + Math.random() * 0.4;
    sizes[i] = 0.5 + Math.random() * 1.1;
    phases[i] = Math.random();
  }

  geometry.setAttribute("aAngle", new InstancedBufferAttribute(angles, 1));
  geometry.setAttribute("aJitter", new InstancedBufferAttribute(jitters, 1));
  geometry.setAttribute("aSpeed", new InstancedBufferAttribute(speeds, 1));
  geometry.setAttribute("aSize", new InstancedBufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new InstancedBufferAttribute(phases, 1));
  return geometry;
}

/**
 * A ring of particles streaming around a tilted circle, with a bright arc fixed
 * in space that grows with load progress.
 *
 * The arc is anchored to *world* angle rather than to the particles, so each
 * particle ignites as it crosses into the completed portion and dims as it
 * leaves. That is what makes the ring read as filling rather than merely
 * spinning.
 *
 * Every tunable is a uniform so three's Inspector can drive it live; only
 * PARTICLE_COUNT requires a rebuild.
 */
/**
 * Dev-only preview state, shared as a module singleton.
 *
 * A singleton rather than React state on purpose: the Inspector writes it
 * outside React, nothing should re-render when it changes, and parts of the
 * scene unrelated to the ring need to read it — hiding the ship while the loop
 * preview runs, for one. Only ever touched by development tooling.
 */
export const LOADING_RING_PREVIEW: LoadingRingOverride = {
  isLooping: false,
  loopSeconds: 4,
  isPinned: false,
  progress: 0.5,
  dispersion: 0,
};

export function createLoadingRing(): {
  geometry: InstancedBufferGeometry;
  material: SpriteNodeMaterial;
  uniforms: LoadingRingUniforms;
  override: LoadingRingOverride;
} {
  const override = LOADING_RING_PREVIEW;

  const uniforms: LoadingRingUniforms = {
    progress: floatUniform(0),
    dispersion: floatUniform(0),
    radius: floatUniform(42),
    tilt: floatUniform(0.55),
    spinSpeed: floatUniform(0.25),
    spriteSize: floatUniform(0.7),
    glow: floatUniform(1.6),
    arcSoftness: floatUniform(0.06),
    bandThickness: floatUniform(0.035),
  };

  // The explicit type argument matters: `attribute("x", "float")` widens the
  // type parameter to `string`, which loses every arithmetic method on the node.
  const aAngle = attribute<"float">("aAngle", "float");
  const aJitter = attribute<"float">("aJitter", "float");
  const aSpeed = attribute<"float">("aSpeed", "float");
  const aSize = attribute<"float">("aSize", "float");
  const aPhase = attribute<"float">("aPhase", "float");

  const angle = aAngle.add(time.mul(uniforms.spinSpeed).mul(aSpeed));
  const spread = uniforms.radius.mul(uniforms.bandThickness);
  const ringRadius = uniforms.radius.add(aJitter.mul(spread));
  const wobble = sin(time.mul(WOBBLE_RATE).add(aPhase.mul(TAU))).mul(spread);

  const flat = vec3(
    cos(angle).mul(ringRadius),
    wobble,
    sin(angle).mul(ringRadius)
  );

  // Tilt the ring plane about X so it presents as a ring rather than a flat line.
  const tiltCos = cos(uniforms.tilt);
  const tiltSin = sin(uniforms.tilt);
  const tilted = vec3(
    flat.x,
    flat.y.mul(tiltCos).sub(flat.z.mul(tiltSin)),
    flat.y.mul(tiltSin).add(flat.z.mul(tiltCos))
  );

  // Burst: outward along the radial direction, plus a lift.
  const outward = normalize(vec3(tilted.x, 0, tilted.z));
  const dispersed = tilted
    .add(outward.mul(uniforms.dispersion.mul(DISPERSE_DISTANCE)))
    .add(vec3(0, uniforms.dispersion.mul(DISPERSE_LIFT), 0));

  // Where this particle sits around the ring, in 0..1 — the arc is measured in
  // this space, which is why it stays put while particles travel through it.
  const arcPos = fract(angle.div(TAU));
  const inArc = oneMinus(
    smoothstep(uniforms.progress.sub(uniforms.arcSoftness), uniforms.progress, arcPos)
  );
  const leadingEdge = oneMinus(
    smoothstep(0, uniforms.arcSoftness, abs(arcPos.sub(uniforms.progress)))
  );

  const tint = mix(color(RING_DIM_COLOR), color(RING_HOT_COLOR), inArc);
  const brightness = uniforms.glow
    .mul(inArc.mul(0.8).add(0.2))
    .add(leadingEdge.mul(EDGE_BOOST));

  // Trim the quad to a soft disc using its real uv attribute.
  // `pointUV` is a vec2 at runtime but @types/three declares it as a bare Node,
  // so it carries no arithmetic methods; vec2() recovers them without a cast.
  const sprite = oneMinus(
    smoothstep(SPRITE_CORE, SPRITE_EDGE, length(uv().sub(vec2(0.5, 0.5))))
  );

  const material = new SpriteNodeMaterial();
  // For a sprite material, positionNode is the billboard's centre; the quad's
  // own vertices are expanded around it, scaled by scaleNode.
  material.positionNode = dispersed;
  material.colorNode = tint.mul(brightness);
  material.scaleNode = uniforms.spriteSize
    .mul(aSize)
    .mul(float(1).add(leadingEdge.mul(EDGE_SIZE_BOOST)));
  material.opacityNode = sprite
    .mul(inArc.mul(oneMinus(BASE_OPACITY)).add(BASE_OPACITY))
    .mul(oneMinus(uniforms.dispersion));
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;

  return { geometry: createRingGeometry(), material, uniforms, override };
}
