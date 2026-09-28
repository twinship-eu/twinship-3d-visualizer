/**
 * Seascape — 11a. Distance field
 *
 * Turns a mask (white where something is) into the distance from every texel
 * to the nearest white one, with the jump flooding algorithm (Rong & Tan,
 * 2006): each texel remembers the nearest white texel it has heard of, and
 * asks its neighbours at halving distances — N/2, N/4, … 1 — whether they know
 * a nearer one. log2(N) passes find it for every texel at once.
 *
 * Exact at any distance, unlike a blur, whose taps drift apart as it widens:
 * a blur of the hull's footprint spread over metres came out in steps.
 */
import { Fn, If, ivec2, screenCoordinate, textureLoad, vec2, vec4 } from "three/tsl";
import { HalfFloatType, NearestFilter, NodeMaterial, QuadMesh, RenderTarget, type Renderer } from "three/webgpu";

/** Mask values above this count as inside. */
const INSIDE = 0.5;
/** Largest distance written, in texels: past it, "far" is all that matters. */
const FAR = 1.0e4;

/**
 * Builds the passes for a `resolution`² mask. `run` reads `mask` and writes
 * into `output` (r: the distance to the mask, in texels).
 *
 * @param maxDistance how far out the distances are needed, in texels. The
 *   first jump is the power of two at or above it, not half the texture:
 *   jumps of k, k/2 … 1 reach 2k - 1 texels, so the distances up to
 *   `maxDistance` come out exact and three or four passes are saved. Past it
 *   they may come out too large, or as FAR. Without it, the whole texture.
 */
export function createDistanceField(resolution: number, maxDistance = resolution / 2) {
  const steps = Math.log2(resolution);
  if (!Number.isInteger(steps)) throw new Error(`Distance field size must be a power of two, got ${resolution}`);

  // (x, y) of the nearest inside texel found so far, z = 1 once one is found.
  // Half floats: they hold whole numbers exactly up to 2048, so a texel's
  // coordinates lose nothing, and every WebGPU renders into them. (In 32-bit
  // floats, on an iPhone — Safari's WebGPU, which Chrome on iOS uses too — the
  // whole footprint read as touching the hull: one square of foam round the
  // ship. Not seen on Chrome's own WebGPU)
  const targetOptions = {
    type: HalfFloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
  };
  const ping = new RenderTarget(resolution, resolution, targetOptions);
  const pong = new RenderTarget(resolution, resolution, targetOptions);
  const texel = () => ivec2(screenCoordinate.x, screenCoordinate.y);

  /** Seeds: every inside texel knows itself. */
  const seedMaterial = (mask: RenderTarget) => {
    const material = new NodeMaterial();
    material.fragmentNode = Fn(() => {
      const here = texel();
      const inside = textureLoad(mask.texture, here).r.greaterThan(INSIDE);

      return inside.select(vec4(vec2(here), 1.0, 1.0), vec4(0.0, 0.0, 0.0, 1.0));
    })();

    return material;
  };

  /** One jump: the nearest of what this texel and its 8 neighbours `step` away know. */
  const jumpMaterial = (source: RenderTarget, step: number) => {
    const material = new NodeMaterial();
    material.fragmentNode = Fn(() => {
      const here = texel();
      const position = vec2(here);
      const best = vec4(0.0, 0.0, 0.0, 1.0).toVar();
      const bestDistance = vec2(FAR, 0.0).x.toVar();

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const clamped = position.add(vec2(dx * step, dy * step)).clamp(0.0, resolution - 1);
          const neighbour = ivec2(clamped.x, clamped.y);
          const known = textureLoad(source.texture, neighbour);
          const distance = known.xy.sub(position).length();
          If(known.z.greaterThan(0.5).and(distance.lessThan(bestDistance)), () => {
            best.assign(known);
            bestDistance.assign(distance);
          });
        }
      }

      return best;
    })();

    return material;
  };

  /** The result: the distance to the nearest inside texel, in texels. */
  const resolveMaterial = (source: RenderTarget) => {
    const material = new NodeMaterial();
    material.fragmentNode = Fn(() => {
      const known = textureLoad(source.texture, texel());
      const distance = known.z.greaterThan(0.5).select(known.xy.sub(vec2(texel())).length(), FAR);

      return vec4(distance, distance, distance, 1.0);
    })();

    return material;
  };

  /**
   * Fills `output` with FAR, once: should a pass ever fail on some GPU, the
   * field reads "far from everything", not 0 — the texture's first contents,
   * which read as touching the hull everywhere.
   */
  const farMaterial = new NodeMaterial();
  farMaterial.fragmentNode = vec4(FAR, FAR, FAR, 1.0);
  const farQuad = new QuadMesh(farMaterial);

  let passesFor: RenderTarget | null = null;
  let passes: { quad: QuadMesh; target: RenderTarget }[] = [];

  /** Builds the chain for this mask and output, once. */
  function buildPasses(mask: RenderTarget, output: RenderTarget) {
    const chain = [{ quad: new QuadMesh(seedMaterial(mask)), target: ping }];
    let source = ping;
    const firstStep = Math.min(2 ** Math.ceil(Math.log2(Math.max(maxDistance, 1))), resolution / 2);
    for (let step = firstStep; step >= 1; step /= 2) {
      const target = source === ping ? pong : ping;
      chain.push({ quad: new QuadMesh(jumpMaterial(source, step)), target });
      source = target;
    }
    chain.push({ quad: new QuadMesh(resolveMaterial(source)), target: output });

    return chain;
  }

  /** Computes the distance field of `mask` into `output`. */
  function run(renderer: Renderer, mask: RenderTarget, output: RenderTarget) {
    if (passesFor !== mask) {
      renderer.setRenderTarget(output);
      farQuad.render(renderer);
      passes = buildPasses(mask, output);
      passesFor = mask;
    }
    for (const { quad, target } of passes) {
      renderer.setRenderTarget(target);
      quad.render(renderer);
    }
  }

  return { run };
}
