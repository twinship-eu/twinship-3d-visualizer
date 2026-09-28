/**
 * Seascape — 13. The ship's wake
 *
 * The churned, foamy water a ship leaves behind it, the way Bruno Simon draws
 * his car's tracks: a texture that remembers where the ship has been.
 *
 * It lies in the ship's frame — the ship stays at the origin and the sea
 * flows past it — and covers a long strip behind the stern. Every frame:
 *
 * 1. what was there flows back by as far as the ship sailed, as the water does;
 * 2. it fades, and spreads a little sideways, as the churned water calms and
 *    mixes with the water around it;
 * 3. the water right around the hull is stamped in at full strength
 *    (`ContactFoam.distanceAt`), so the trail starts at the hull and runs
 *    back from the stern.
 *
 * The sea reads it (`sample`) and draws the trail as foam.
 */
import { float, Fn, max, mix, smoothstep, texture, uniform, uv, vec2, vec4 } from "three/tsl";
import {
  HalfFloatType,
  LinearFilter,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type Node,
  type Renderer,
} from "three/webgpu";
import type { ContactFoam } from "./seascape-contact-foam";

/** The strip the wake covers, in the ship's frame, in world units: bow at +z. */
const WAKE_AREA = {
  width: 160,
  /** Just ahead of the bow, so the whole hull stamps into it. */
  front: 110,
  length: 1024,
} as const;
/** Texels across and along the strip: about 1.25 m by 1 m. */
const WAKE_RESOLUTION = { across: 128, along: 1024 } as const;

/**
 * How far from the hull the water is stirred into the wake, in world units:
 * the churn the hull and propellers leave just outside it.
 */
const STIRRED_WIDTH = 4;
/**
 * Seconds for the wake to fade to about a third: at 18 knots, a trail a few
 * hundred metres long.
 */
const WAKE_LIFETIME = 40;
/**
 * How much of each texel mixes with its neighbours per second: softens the
 * trail's edges.
 */
const WAKE_SPREAD_PER_SECOND = 1.5;
/**
 * How fast the trail's edges move outwards, in world units per second. A
 * ship's turbulent wake widens steadily behind the stern: at 18 knots, this
 * takes a 16 m trail to about 60 m wide 400 m back. (Mixing alone widened it
 * only as the square root of its age, and it stayed a thin stripe.)
 */
const WAKE_WIDENING_SPEED = 0.5;

/** Ship speed, in m/s, at which it stirs a full wake; slower, a fainter one. */
const FULL_WAKE_SPEED = 4;

export function createWake(contactFoam: ContactFoam) {
  const uniforms = {
    /** How far the ship sailed since the last frame, in world units. */
    sailed: uniform(0),
    /** How much of the wake survives this frame's fading. */
    kept: uniform(1),
    /** How much of each texel mixes with its neighbours this frame. */
    spread: uniform(0),
    /** How strongly the hull stirs the water this frame, from 0 (at rest) to 1. */
    stirring: uniform(0),
    /** How far the trail's edges move outwards this frame, in uv across. */
    widening: uniform(0),
  };

  const targetOptions = {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  };
  const targets = [
    new RenderTarget(WAKE_RESOLUTION.across, WAKE_RESOLUTION.along, targetOptions),
    new RenderTarget(WAKE_RESOLUTION.across, WAKE_RESOLUTION.along, targetOptions),
  ];

  /** The strip's uv at a world point in the ship's frame, and back. */
  const toWakeUV = (position: Node<"vec2">) =>
    vec2(position.x.div(WAKE_AREA.width).add(0.5), float(WAKE_AREA.front).sub(position.y).div(WAKE_AREA.length));
  const toWorld = (wakeUV: Node<"vec2">) =>
    vec2(wakeUV.x.sub(0.5).mul(WAKE_AREA.width), float(WAKE_AREA.front).sub(wakeUV.y.mul(WAKE_AREA.length)));

  /** One frame's step, reading `previous`. */
  function createStepMaterial(previous: RenderTarget) {
    const material = new NodeMaterial();
    const texelAcross = 1 / WAKE_RESOLUTION.across;
    const texelAlong = 1 / WAKE_RESOLUTION.along;

    material.fragmentNode = Fn(() => {
      const here = uv();
      // 1. The water here was, last frame, as far ahead as the ship sailed
      const from = here.sub(vec2(0.0, uniforms.sailed.div(WAKE_AREA.length)));
      const read = (at: Node<"vec2">) => {
        const inStrip = at.y.greaterThanEqual(0.0);

        return inStrip.select(texture(previous.texture, at).r, 0.0);
      };
      const centre = read(from);
      const neighbours = read(from.add(vec2(texelAcross, 0.0)))
        .add(read(from.sub(vec2(texelAcross, 0.0))))
        .add(read(from.add(vec2(0.0, texelAlong))))
        .add(read(from.sub(vec2(0.0, texelAlong))))
        .mul(0.25);

      // 2. Widen, spread a little, and fade. Widening takes the strongest of
      //    this texel and those just beside it, so the edges move outwards
      const beside = max(
        read(from.add(vec2(uniforms.widening, 0.0))),
        read(from.sub(vec2(uniforms.widening, 0.0)))
      );
      const carried = mix(max(centre, beside), neighbours, uniforms.spread).mul(uniforms.kept);

      // 3. The hull stirs the water around it
      const distance = contactFoam.distanceAt(toWorld(here));
      // (1 - smoothstep rather than reversed edges, which WGSL rejects as constants)
      const stirred = smoothstep(0.0, STIRRED_WIDTH, distance).oneMinus().mul(uniforms.stirring);
      const wake = max(carried, stirred);

      return vec4(wake, wake, wake, 1.0);
    })();

    return material;
  }

  // Two steps, one reading each target, so the frames ping-pong between them
  const steps = [new QuadMesh(createStepMaterial(targets[1])), new QuadMesh(createStepMaterial(targets[0]))];
  let current = 0;

  /** Moves the wake on by `elapsed` seconds, the ship sailing at `speed` m/s. */
  function update(renderer: Renderer, elapsed: number, speed: number) {
    uniforms.sailed.value = speed * elapsed;
    uniforms.kept.value = Math.exp(-elapsed / WAKE_LIFETIME);
    uniforms.spread.value = Math.min(WAKE_SPREAD_PER_SECOND * elapsed, 1);
    uniforms.stirring.value = Math.min(Math.max(speed / FULL_WAKE_SPEED, 0), 1);
    uniforms.widening.value = (WAKE_WIDENING_SPEED * elapsed) / WAKE_AREA.width;

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(targets[current]);
    steps[current].render(renderer);
    renderer.setRenderTarget(previousTarget);

    wakeTexture.value = targets[current].texture;
    current = 1 - current;
  }

  const wakeTexture = texture(targets[0].texture);

  /** How much wake lies at a world point in the ship's frame: 0 to 1. */
  function sample(position: Node<"vec2">) {
    const wakeUV = toWakeUV(position);
    const inStrip = wakeUV.x
      .greaterThan(0.0)
      .and(wakeUV.x.lessThan(1.0))
      .and(wakeUV.y.greaterThan(0.0).and(wakeUV.y.lessThan(1.0)));

    return inStrip.select(texture(wakeTexture, wakeUV).r, 0.0);
  }

  return { update, sample };
}

export type Wake = ReturnType<typeof createWake>;
