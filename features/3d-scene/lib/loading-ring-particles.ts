import { IS_SCENE_INSPECTOR_ENABLED } from "./3d-scene-config";
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
/**
 * Share of the burst spent staggering the starts. Without it every particle
 * leaves at once, which reads as the whole ring scaling up rather than as
 * individual bubbles breaking away.
 */
const BURST_DELAY_SPREAD = 0.55;
/** Sideways drift while rising, as a fraction of the outward distance. */
const BURST_LATERAL = 0.45;
/** Sideways wobble rate while rising. */
const BURST_WOBBLE_RATE = 2.3;
/** How much bubbles swell as they rise. */
const BURST_GROWTH = 0.8;
/** Extra brightness and size right at the arc's leading edge. */
const EDGE_BOOST = 2.2;
const EDGE_SIZE_BOOST = 0.9;
/** Vertical breathing of the ring band. */
const WOBBLE_RATE = 0.7;
/**
 * Animated share of the band's vertical spread. Kept small: the rest is a flat
 * random offset, because animating the *whole* offset with a sine is what
 * produced a hard line at each edge of the band.
 */
const BAND_WOBBLE = 0.15;
/** Where the band starts fading out, as a fraction of its half-height. */
const BAND_FADE_START = 0.72;
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

  // Packed into two vec4s rather than eight scalars: WebGPU caps a pipeline at
  // 8 vertex buffers, and position + uv + eight scalar attributes is 10.
  const ring = new Float32Array(PARTICLE_COUNT * 4);
  const burst = new Float32Array(PARTICLE_COUNT * 4);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = i * 4;
    ring[r] = Math.random() * TAU; // angle around the ring
    ring[r + 1] = Math.random() * 2 - 1; // band jitter
    ring[r + 2] = 0.8 + Math.random() * 0.4; // orbit speed
    ring[r + 3] = 0.5 + Math.random() * 1.1; // sprite size

    burst[r] = Math.random(); // wobble phase
    burst[r + 1] = Math.random(); // burst start delay
    burst[r + 2] = 0.35 + Math.random() * 1.3; // rise rate
    burst[r + 3] = 0.3 + Math.random() * 1.2; // outward distance
  }

  geometry.setAttribute("aRing", new InstancedBufferAttribute(ring, 4));
  geometry.setAttribute("aBurst", new InstancedBufferAttribute(burst, 4));
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
  // On by default in development so a refresh always shows the loading
  // animation, with the ship hidden. Must never be on in production, or the
  // loader would replay forever and never hand over to the scene.
  isLooping: IS_SCENE_INSPECTOR_ENABLED,
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
    radius: floatUniform(33),
    tilt: floatUniform(0),
    spinSpeed: floatUniform(0.72),
    spriteSize: floatUniform(1.2),
    glow: floatUniform(6),
    arcSoftness: floatUniform(0.01),
    bandThickness: floatUniform(0.3),
  };

  // The explicit type argument matters: `attribute("x", "vec4")` widens the type
  // parameter to `string`, which loses every arithmetic method on the node.
  const aRing = attribute<"vec4">("aRing", "vec4");
  const aBurst = attribute<"vec4">("aBurst", "vec4");

  const aAngle = aRing.x;
  const aJitter = aRing.y;
  const aSpeed = aRing.z;
  const aSize = aRing.w;
  const aPhase = aBurst.x;
  const aBurstDelay = aBurst.y;
  const aBurstLift = aBurst.z;
  const aBurstSpread = aBurst.w;

  const angle = aAngle.add(time.mul(uniforms.spinSpeed).mul(aSpeed));
  const spread = uniforms.radius.mul(uniforms.bandThickness);
  const ringRadius = uniforms.radius.add(aJitter.mul(spread));

  // Height across the band must be *uniformly* distributed. Deriving it from
  // sin() of a uniform phase, as this first did, is arcsine-distributed: it
  // piles particles at both extremes and draws a hard horizontal line at each
  // edge of the band. aBurstDelay is reused as the uniform source — the only
  // correlation it introduces is that higher bubbles burst slightly later,
  // which is harmless and arguably right.
  const bandHeight = aBurstDelay.mul(2).sub(1);
  const wobble = sin(time.mul(WOBBLE_RATE).add(aPhase.mul(TAU))).mul(BAND_WOBBLE);
  const bandY = bandHeight.add(wobble).mul(spread);

  const flat = vec3(
    cos(angle).mul(ringRadius),
    bandY,
    sin(angle).mul(ringRadius)
  );

  // Belt and braces against a visible band edge: fade the outermost particles.
  const bandFade = oneMinus(smoothstep(BAND_FADE_START, 1, abs(bandHeight)));

  // Tilt the ring plane about X so it presents as a ring rather than a flat line.
  const tiltCos = cos(uniforms.tilt);
  const tiltSin = sin(uniforms.tilt);
  const tilted = vec3(
    flat.x,
    flat.y.mul(tiltCos).sub(flat.z.mul(tiltSin)),
    flat.y.mul(tiltSin).add(flat.z.mul(tiltCos))
  );

  // Burst, as bubbles rather than as a uniform expansion.
  //
  // Each particle gets its own start time, so they break away in a scatter
  // instead of the whole ring scaling up together; its own rise rate and
  // distance; a sideways wobble while rising; and a little swelling, the way a
  // bubble does. `burst` is this particle's own 0..1 progress through its own
  // portion of the dispersion.
  const burstStart = aBurstDelay.mul(BURST_DELAY_SPREAD);
  const burst = uniforms.dispersion
    .sub(burstStart)
    .div(float(1).sub(burstStart))
    .clamp(0, 1);

  const outward = normalize(vec3(tilted.x, 0, tilted.z));
  const wobble2 = sin(time.mul(BURST_WOBBLE_RATE).add(aPhase.mul(TAU)));
  const lateral = vec3(outward.z.negate(), 0, outward.x).mul(
    wobble2.mul(burst).mul(DISPERSE_DISTANCE).mul(BURST_LATERAL)
  );

  const dispersed = tilted
    .add(outward.mul(burst.mul(DISPERSE_DISTANCE).mul(aBurstSpread)))
    .add(lateral)
    // Squared, so bubbles accelerate upward instead of drifting linearly.
    .add(vec3(0, burst.mul(burst).mul(DISPERSE_LIFT).mul(aBurstLift), 0));

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
    .mul(float(1).add(leadingEdge.mul(EDGE_SIZE_BOOST)))
    .mul(float(1).add(burst.mul(BURST_GROWTH)));
  material.opacityNode = sprite
    .mul(bandFade)
    .mul(inArc.mul(oneMinus(BASE_OPACITY)).add(BASE_OPACITY))
    // Fades on this particle's own burst, so bubbles wink out in a scatter.
    .mul(oneMinus(burst));
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;

  return { geometry: createRingGeometry(), material, uniforms, override };
}
