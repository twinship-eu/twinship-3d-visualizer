import {
  LOADING_RING_TIMING,
  RING_WATERLINE_Y,
} from "./3d-scene-config";
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

/**
 * Baked into the geometry, so it is the one thing the GUI cannot change live.
 *
 * High because these particles have to read as a 200m ship at the end, not just
 * as a ring: at a couple of thousand the assembled hull looks like scattered
 * dust rather than a silhouette.
 */
const PARTICLE_COUNT = 12000;

/**
 * Distinct positions around the ring. Fewer than PARTICLE_COUNT: several
 * particles share each slot, so the ring keeps the density it was tuned at
 * while still having enough particles to trace a whole ship afterwards.
 */
const RING_SLOT_COUNT = 2400;

/** Particles per ring slot. */
const RING_STACK = PARTICLE_COUNT / RING_SLOT_COUNT;

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
/**
 * Share of the assembly spent staggering arrivals, so particles land in a
 * sweep rather than all snapping into the hull on the same frame.
 */
const ASSEMBLY_DELAY_SPREAD = 0.4;
/** Height of the arc particles travel on their way to the hull. */
const ASSEMBLY_ARC_LIFT = 6;
/** How much smaller particles get once settled on the hull. */
const ASSEMBLY_SHRINK = 0.45;
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
/**
 * Share of the fade spent staggering, so particles wink out in a scatter rather
 * than the whole cloud dimming in lockstep.
 */
const FADE_DELAY_SPREAD = 0.45;

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
  /** Replay the whole sequence forever, for looking at it. */
  isLooping: boolean;
  /**
   * Duration of one sweep of the arc. The fill repeats in whole cycles of this
   * length, in the real sequence as well as in the preview.
   */
  fillSeconds: number;
  /** Particles flying from the ring onto the hull. Its own timing, not a share
   * of the fill. */
  convergeSeconds: number;
  /** The assembled particle silhouette holding still. */
  holdSeconds: number;
  /** Particles fading out over the newly revealed ship. */
  revealSeconds: number;
  /**
   * Written by the ring every frame, read by the ship: 0 = hidden, 1 = fully
   * opaque. Not a setting.
   *
   * A shared mutable rather than React state because it changes per frame and
   * has to cross the tree — routing it through state would re-render the scene
   * at frame rate during the handover it exists to smooth.
   */
  shipReveal: number;
  /** Freeze the ring at the values below, so any moment can be inspected. */
  isPinned: boolean;
  progress: number;
  dispersion: number;
  assembly: number;
  fade: number;
};

export type LoadingRingUniforms = {
  /** 0 = particles on the ring, 1 = particles on their sampled ship points. */
  assembly: FloatUniform;
  /** Ring height above the water. Held here because the mesh sits at the origin,
   * so that ship targets can stay in world space. */
  waterline: FloatUniform;
  /** 0 -> 1 as the model loads. Drives how far the bright arc has swept. */
  progress: FloatUniform;
  /** 0 = intact ring, 1 = fully burst and faded. Tuning only; the real
   * sequence assembles instead of bursting. */
  dispersion: FloatUniform;
  /** 1 = particles visible, 0 = faded out over the revealed ship. */
  fade: FloatUniform;
  /**
   * 0 = the arc fills in as progress rises; 1 = it empties instead.
   *
   * Alternating between the two across successive cycles is what makes a
   * repeated fill read as one continuous animation: at every boundary the lit
   * region matches on both sides, so nothing jumps back to empty.
   */
  arcInvert: FloatUniform;
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

  // One set of ring slots, reused across the stack: particles sharing a slot sit
  // on top of each other in ring form and only separate once they fly to the
  // ship, where each has its own target.
  const slots = new Float32Array(RING_SLOT_COUNT * 4);
  for (let slot = 0; slot < RING_SLOT_COUNT; slot++) {
    const o = slot * 4;
    slots[o] = Math.random() * TAU; // angle around the ring
    slots[o + 1] = Math.random() * 2 - 1; // band jitter
    slots[o + 2] = 0.8 + Math.random() * 0.4; // orbit speed
    slots[o + 3] = 0.5 + Math.random() * 1.1; // sprite size
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = i * 4;
    // Modulo rather than division, so each slot's stack is spread through the
    // buffer instead of sitting in one contiguous run.
    const o = (i % RING_SLOT_COUNT) * 4;
    ring[r] = slots[o];
    ring[r + 1] = slots[o + 1];
    ring[r + 2] = slots[o + 2];
    ring[r + 3] = slots[o + 3];

    burst[r] = Math.random(); // wobble phase
    burst[r + 1] = Math.random(); // burst start delay
    burst[r + 2] = 0.35 + Math.random() * 1.3; // rise rate
    burst[r + 3] = 0.3 + Math.random() * 1.2; // outward distance
  }

  geometry.setAttribute("aRing", new InstancedBufferAttribute(ring, 4));
  geometry.setAttribute("aBurst", new InstancedBufferAttribute(burst, 4));
  // Filled in once the model loads; until then every target is the origin and
  // the assembly uniform stays at 0, so it is never read.
  geometry.setAttribute(
    "aTarget",
    new InstancedBufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3)
  );
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
export const LOADING_RING_STATE: LoadingRingOverride = {
  // Off by default: the sequence should run once and hand over to the ship, so
  // the moment it becomes interactive can be felt. Tick it in the GUI to replay.
  isLooping: false,
  fillSeconds: LOADING_RING_TIMING.FILL_MS / 1000,
  convergeSeconds: LOADING_RING_TIMING.CONVERGE_MS / 1000,
  holdSeconds: LOADING_RING_TIMING.HOLD_MS / 1000,
  revealSeconds: LOADING_RING_TIMING.REVEAL_MS / 1000,
  isPinned: false,
  progress: 0.5,
  dispersion: 0,
  assembly: 0,
  fade: 1,
  shipReveal: 0,
};

export function createLoadingRing(): {
  geometry: InstancedBufferGeometry;
  material: SpriteNodeMaterial;
  uniforms: LoadingRingUniforms;
  override: LoadingRingOverride;
} {
  const override = LOADING_RING_STATE;

  const uniforms: LoadingRingUniforms = {
    assembly: floatUniform(0),
    waterline: floatUniform(RING_WATERLINE_Y),
    progress: floatUniform(0),
    dispersion: floatUniform(0),
    fade: floatUniform(1),
    arcInvert: floatUniform(0),
    radius: floatUniform(17),
    tilt: floatUniform(0),
    spinSpeed: floatUniform(0.72),
    spriteSize: floatUniform(0.45),
    glow: floatUniform(6),
    arcSoftness: floatUniform(0.375),
    bandThickness: floatUniform(0.195),
  };

  // The explicit type argument matters: `attribute("x", "vec4")` widens the type
  // parameter to `string`, which loses every arithmetic method on the node.
  const aRing = attribute<"vec4">("aRing", "vec4");
  const aBurst = attribute<"vec4">("aBurst", "vec4");
  const aTarget = attribute<"vec3">("aTarget", "vec3");

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

  // The ring lives at the origin so ship targets can stay in world space; its
  // height is added here instead of on the mesh.
  const ringPosition = dispersed.add(vec3(0, uniforms.waterline, 0));

  // Assembly: fly to this particle's own sampled point on the hull. Staggered
  // per particle and smoothstepped, so arrivals sweep across the ship and ease
  // in rather than snapping.
  const assemblyStart = aBurstDelay.mul(ASSEMBLY_DELAY_SPREAD);
  const assembly = smoothstep(
    assemblyStart,
    assemblyStart.add(float(1).sub(ASSEMBLY_DELAY_SPREAD)),
    uniforms.assembly
  );
  // A lift partway through, so particles arc onto the hull instead of sliding
  // along a straight line into it.
  const arc = sin(assembly.mul(Math.PI)).mul(ASSEMBLY_ARC_LIFT).mul(aBurstLift);
  const assembled = mix(ringPosition, aTarget, assembly).add(
    vec3(0, arc, 0)
  );

  // Where this particle sits around the ring, in 0..1 — the arc is measured in
  // this space, which is why it stays put while particles travel through it.
  const arcPos = fract(angle.div(TAU));
  // Filling in lights everything behind the sweeping edge; filling out lights
  // everything ahead of it. Both run in the same direction and at the same
  // speed, and each cycle ends exactly where the next begins.
  //
  // The edge deliberately travels further than the ring: `arcSoftness` wide of
  // it is a soft gradient, and unless that gradient clears the domain entirely
  // the boundary is not clean. Sweeping only 0..1 leaves fill-in ending with a
  // dark band just *before* arc position 0 while fill-out starts with one just
  // *after* it — two different bands, each as wide as the softness, so the dark
  // region appears to teleport around the ring. Invisible at a softness of
  // 0.01; very visible at 0.375. Extending the sweep by the softness at the
  // trailing end makes fill-in finish uniformly lit and fill-out start
  // uniformly lit, which is what makes the two halves join.
  // One edge, swept from just before the ring to just after it: from `-soft` to
  // `1`, so its soft band [sweep, sweep + soft] lies entirely outside 0..1 at
  // both ends of a cycle. That is what makes a cycle finish uniformly lit and
  // the next start uniformly lit — and it must cover *everything* keyed to the
  // edge, the highlight included, or whatever is left behind teleports on its
  // own.
  const soft = uniforms.arcSoftness;
  const sweep = soft.negate().add(uniforms.progress.mul(float(1).add(soft)));

  // Fill-out is the exact complement of fill-in against the same swept edge, so
  // the two share one geometry and cannot disagree at a boundary.
  const fillsIn = oneMinus(smoothstep(sweep, sweep.add(soft), arcPos));
  const inArc = mix(fillsIn, oneMinus(fillsIn), uniforms.arcInvert);
  // Centred inside the swept band rather than on raw `progress`. Keyed to
  // `progress` it sat in a different place from the gradient, so at a cycle
  // boundary this bright, enlarged band jumped a third of the way around the
  // ring while the ring itself stayed uniformly lit — visible precisely because
  // the fill no longer jumps.
  const edgeCentre = sweep.add(soft.mul(0.5));
  const leadingEdge = oneMinus(
    smoothstep(0, soft.mul(0.5), abs(arcPos.sub(edgeCentre)))
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
  material.positionNode = assembled;
  material.colorNode = tint.mul(brightness);
  material.scaleNode = uniforms.spriteSize
    .mul(aSize)
    .mul(float(1).add(leadingEdge.mul(EDGE_SIZE_BOOST)))
    .mul(float(1).add(burst.mul(BURST_GROWTH)))
    // Settled particles shrink, so the assembled hull reads as fine grain
    // rather than as a cloud of blobs.
    .mul(float(1).sub(assembly.mul(ASSEMBLY_SHRINK)));
  // Once assembling, every particle is fully lit: the arc gradient belongs to
  // the ring, and letting it survive would leave half the hull dim.
  const litness = mix(
    inArc.mul(oneMinus(BASE_OPACITY)).add(BASE_OPACITY),
    float(1),
    assembly
  );

  // Coincident particles add up under additive blending, so a stacked slot would
  // be RING_STACK times too bright. Dividing it back out makes the ring look
  // like RING_SLOT_COUNT sprites; the compensation lifts to 1 as they assemble,
  // where every particle occupies its own point on the hull.
  const stackCompensation = mix(float(1 / RING_STACK), float(1), assembly);

  // Staggered per particle, using the same random that staggers the assembly.
  // A single global fade dims every particle in lockstep, which reads as the
  // whole cloud being turned down rather than as particles leaving.
  const fadeStart = aBurstDelay.mul(FADE_DELAY_SPREAD);
  const staggeredFade = smoothstep(
    fadeStart,
    fadeStart.add(float(1).sub(FADE_DELAY_SPREAD)),
    uniforms.fade
  );

  material.opacityNode = sprite
    .mul(stackCompensation)
    .mul(staggeredFade)
    .mul(mix(bandFade, float(1), assembly))
    .mul(litness)
    // Fades on this particle's own burst, so bubbles wink out in a scatter.
    .mul(oneMinus(burst));
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  // Never depth-tested. Once assembled, most particles sit on the far side of
  // the hull, so as soon as the revealed ship starts writing depth again they
  // are occluded and vanish in a single frame — which is what made part of the
  // cloud disappear abruptly instead of fading. Drawing them unconditionally
  // keeps the fade the only thing that removes them.
  material.depthTest = false;

  return { geometry: createRingGeometry(), material, uniforms, override };
}

/**
 * Copies sampled ship-surface points into the ring's target attribute.
 *
 * Tolerates a length mismatch: the sampler is asked for exactly
 * PARTICLE_COUNT points, but taking the shorter of the two means a future
 * change to either side degrades to "some particles stay put" rather than
 * reading past the end of a buffer.
 */
export function setAssemblyTargets(
  geometry: InstancedBufferGeometry,
  points: Float32Array
): void {
  const target = geometry.getAttribute("aTarget");
  const values = target.array as Float32Array;
  values.set(points.subarray(0, Math.min(values.length, points.length)));
  target.needsUpdate = true;
}

/** How many surface points the ring needs to assemble a model. */
export const ASSEMBLY_POINT_COUNT = PARTICLE_COUNT;
