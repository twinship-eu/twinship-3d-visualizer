/**
 * Seascape — 20. Foam that stays in the water
 *
 * A breaking crest runs on; the foam it leaves does not. It lies in the
 * water, drifting no faster than the water, and fades in some seconds. Drawn
 * only on the crests, every white patch travelled with the waves — across
 * the ship's path when they come off the bow — and the ship seemed to slide
 * sideways. With the foam left in the water, the eye has what it reads motion
 * from: white flowing past the hull at the ship's own speed.
 *
 * As the wake does (`seascape-wake.ts`), a texture remembers it, in the ship's
 * frame over a square round the ship. Every frame:
 *
 * 1. what was there flows back by as far as the ship sailed, as the water does;
 * 2. it fades;
 * 3. where the crests are breaking now, the foam is stamped in (`stamp`, given
 *    by the sea's shader, which knows the waves).
 *
 * The sea reads it (`sample`) and draws it as foam behind the crests.
 */
import { float, Fn, max, texture, uniform, uv, vec2, vec4 } from "three/tsl";
import { HalfFloatType, LinearFilter, NodeMaterial, QuadMesh, RenderTarget, type Node, type Renderer } from "three/webgpu";

/**
 * The square it covers, in the ship's frame, in world units: centred a little
 * ahead of the ship, where one looks from the default views. Beyond it the
 * crests keep only their own foam — far off, their motion reads as the sea's.
 */
const MEMORY_AREA = { size: 640, centreZ: 60 } as const;
/** Texels across: 1.25 world units (2.5 m) each, finer than a whitecap. */
const MEMORY_RESOLUTION = 512;
/** Seconds for the left foam to fade to about a third: the streaks a breaking sea leaves. */
const MEMORY_LIFETIME = 6;

export function createFoamMemory() {
  const uniforms = {
    /** How far the ship sailed since the last frame, in world units. */
    sailed: uniform(0),
    /** How much of the foam survives this frame's fading. */
    kept: uniform(1),
  };

  const targetOptions = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
  const targets = [
    new RenderTarget(MEMORY_RESOLUTION, MEMORY_RESOLUTION, targetOptions),
    new RenderTarget(MEMORY_RESOLUTION, MEMORY_RESOLUTION, targetOptions),
  ];

  /** The square's uv at a point in the ship's frame (x, z), and back. */
  const toMemoryUV = (position: Node<"vec2">) =>
    vec2(position.x.div(MEMORY_AREA.size).add(0.5), float(MEMORY_AREA.centreZ).sub(position.y).div(MEMORY_AREA.size).add(0.5));
  const toWorld = (memoryUV: Node<"vec2">) =>
    vec2(memoryUV.x.sub(0.5).mul(MEMORY_AREA.size), float(MEMORY_AREA.centreZ).sub(memoryUV.y.sub(0.5).mul(MEMORY_AREA.size)));

  /** One frame's step, reading `previous` and stamping what `stamp` says breaks now. */
  function createStepMaterial(previous: RenderTarget, stamp: (world: Node<"vec2">) => Node<"float">) {
    const material = new NodeMaterial();
    material.fragmentNode = Fn(() => {
      const here = uv();
      // 1. The water here was, last frame, as far ahead as the ship sailed
      const from = here.sub(vec2(0.0, uniforms.sailed.div(MEMORY_AREA.size)));
      const inSquare = from.y.greaterThanEqual(0.0).and(from.y.lessThanEqual(1.0));
      const carried = inSquare.select(texture(previous.texture, from).r, 0.0).mul(uniforms.kept);
      // 2-3. Faded, and the crests breaking now stamped in
      const foam = max(carried, stamp(toWorld(here)).clamp(0.0, 1.0));
      return vec4(foam, foam, foam, 1.0);
    })();
    return material;
  }

  let steps: QuadMesh[] | null = null;
  let current = 0;
  const memoryTexture = texture(targets[0].texture);

  return {
    /**
     * Where the crests break, at a point of the ship's frame: 0 to 1. Given by
     * the sea's shader, which knows the waves; the memory runs once it has it.
     */
    setStamp(stamp: (world: Node<"vec2">) => Node<"float">) {
      // Two steps, one reading each target, so the frames ping-pong between them
      steps = [new QuadMesh(createStepMaterial(targets[1], stamp)), new QuadMesh(createStepMaterial(targets[0], stamp))];
    },

    /** Moves the memory on by `elapsed` seconds, the ship sailing at `speed` m/s. */
    update(renderer: Renderer, elapsed: number, speed: number) {
      if (!steps) return;
      uniforms.sailed.value = speed * elapsed;
      uniforms.kept.value = Math.exp(-elapsed / MEMORY_LIFETIME);
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(targets[current]);
      steps[current].render(renderer);
      renderer.setRenderTarget(previousTarget);
      memoryTexture.value = targets[current].texture;
      current = 1 - current;
    },

    /** How much left foam lies at a point in the ship's frame: 0 to 1, none outside the square. */
    sample(position: Node<"vec2">) {
      const memoryUV = toMemoryUV(position);
      const inSquare = memoryUV.x
        .greaterThan(0.0)
        .and(memoryUV.x.lessThan(1.0))
        .and(memoryUV.y.greaterThan(0.0).and(memoryUV.y.lessThan(1.0)));
      return inSquare.select(texture(memoryTexture, memoryUV).r, 0.0);
    },
  };
}

export type FoamMemory = ReturnType<typeof createFoamMemory>;
