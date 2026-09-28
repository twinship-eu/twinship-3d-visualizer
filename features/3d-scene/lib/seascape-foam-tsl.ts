/**
 * Seascape — 6. Crest foam
 *
 * White water on breaking waves.
 *
 * Where the foam is comes from the waves themselves — `windSeaWhitecaps`:
 * where the sea's peaks stand high enough to break, as much of it as the wind
 * makes. This file only decides what that foam looks like:
 *
 * 1. its body  — soft, the whitecap amount eased in, never a cut-out shape;
 * 2. its grain — the foam texture, stretched along the waves' travel into
 *    wisps, and pushed around by the chop so it churns with the water;
 * 3. its light — the same sun as the water.
 *
 * (The foam before this was a height threshold with the texture cut into it:
 * sharp-edged patches that looked like decals, and did not ride the crests.)
 *
 * Everything is in sea space, like the waves: the surface grid follows the
 * camera, so anything tied to the grid itself would slide through the water.
 *
 * The grain is read first, on its own (`foamGrain`), because it also frays the
 * whitecaps' edge — see `windSeaWhitecaps`.
 */
import { dot, float, max, mix, smoothstep, texture, vec2, vec3 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { VISIBLE_WHITECAP } from "./seascape-wind-waves";

/** How much longer the grain is along the waves' travel than across it: wisps, not blobs. */
const GRAIN_STRETCH = 1.6;
/** Sea units covered by one repeat of the grain across the travel. */
const GRAIN_TILE_SIZE = 2.0;
/**
 * A second, coarser read of the grain, averaged with the first: this many
 * times larger, and turned, so neither repeat shows through the other.
 */
const COARSE_GRAIN_SCALE = 2.7;
const COARSE_GRAIN_TURN = 0.9;

/** How fast the grain drifts against the crests, relative to the waves' own speed. */
const GRAIN_DRIFT = vec2(-0.03, 0.05);

/**
 * Whitecap amounts where the foam is spread out (behind the crest) and fresh
 * (on it) — see `crestFoamDensity`.
 */
const SPREAD_FOAM = 0.15;
const FRESH_FOAM = 0.85;
/**
 * How far onto the back face (in `waveFace` units, 1 = fully on it) the foam
 * turns from gathering to aging: crest and front stay fresh.
 */
const BEHIND_CREST_FACE = 0.4;
/** How much longer the foam's edge fades in front of the crest than behind it. */
const FRONT_FADE_LONGER = 1.5;
/** Texel value above which spread foam stays: only its strands. */
const SPREAD_OPENNESS = 0.6;
/** The fresh veil's thinnest, where the grain is lightest, against its thickest. */
const VEIL_THINNEST = 0.55;
/** How soft the strands' edges are, in texel values. */
const LACE_SOFTNESS = 0.12;

/**
 * Whitecap amount at which the foam is at its thickest; it eases in below, and
 * is half as thick at VISIBLE_WHITECAP — where the wind's coverage is measured.
 */
const FULL_WHITECAP = VISIBLE_WHITECAP * 2;
// (The whitecaps' own edge is already frayed by the grain — `windSeaWhitecaps`.)

/**
 * How opaque the thickest foam gets: the water always shows through. At 0.75
 * the crests read as solid white patches.
 */
const MAX_FOAM_DENSITY = 0.55;

/** Foam in the shade of a wave keeps this much of its brightness. */
const SHADED_FOAM_BRIGHTNESS = 0.55;

type FoamGrainInput = {
  /** The point on the sea, in sea space. */
  point: Node<"vec3">;
  /** The direction the waves travel, on the xz plane. */
  travel: Node<"vec2">;
  seaTime: Node<"float">;
  /** The foam mask texture; its red channel is read. */
  foamMap: TextureNode;
  /**
   * Pushes the grain around, in sea units: the water's short chop, so the
   * foam churns with it instead of sliding over the sea like a decal.
   */
  distortion: Node<"vec2">;
};

/**
 * The foam's grain at a point, from 0 (thin) to 1 (thick): the foam texture,
 * read twice and averaged.
 *
 * Must be called outside any branch: its texture reads pick their mip level
 * from derivatives.
 */
export function foamGrain({ point, travel, seaTime, foamMap, distortion }: FoamGrainInput) {
  // The grain's frame: along and across the travel, the along axis shrunk so
  // the texture comes out stretched into wisps
  const position = point.xz.add(distortion);
  const along = dot(position, travel).div(GRAIN_STRETCH);
  const across = dot(position, vec2(travel.y.negate(), travel.x));
  const grainUV = vec2(along, across).div(GRAIN_TILE_SIZE).add(GRAIN_DRIFT.mul(seaTime));
  const cosine = Math.cos(COARSE_GRAIN_TURN);
  const sine = Math.sin(COARSE_GRAIN_TURN);
  const coarseUV = vec2(
    grainUV.x.mul(cosine).sub(grainUV.y.mul(sine)),
    grainUV.x.mul(sine).add(grainUV.y.mul(cosine))
  ).div(COARSE_GRAIN_SCALE);

  const fineTexel = texture(foamMap, grainUV).r;
  const coarseTexel = texture(foamMap, coarseUV).r;

  // x: the fine grain, y: the coarse, larger and turned
  return vec2(fineTexel, coarseTexel);
}

/**
 * How much foam covers a point, from 0 to MAX_FOAM_DENSITY, given how much
 * whitecap foam lies there (`windSeaWhitecaps`: 1 on the breaking crest,
 * falling away behind it) and the grain (`foamGrain`).
 *
 * The whitecap amount stands for how fresh the foam is. On the crest and in
 * front of it, where it gathers, it is fresh — a dense, fine-grained veil,
 * fading softly at its leading edge; behind it, it has been left by the crest
 * and is spreading out — a coarser lace, whose holes open until only the
 * thickest strands are left. `face` is `waveFace`: which side of the big wave. (Before, the grain shaded the foam the
 * same way everywhere, and the foam read as a texture laid over the wave.)
 */
export function crestFoamDensity(whitecaps: Node<"float">, grain: Node<"vec2">, face: Node<"float">) {
  // Foam in front of the crest is still gathering: as fresh as on the crest,
  // whatever the whitecap amount. Only behind it does it age into lace
  const behind = smoothstep(0.0, BEHIND_CREST_FACE, face);
  const fresh = mix(float(1.0), smoothstep(SPREAD_FOAM, FRESH_FOAM, whitecaps), behind);

  // On the crest: a continuous milky veil, the fine grain only shading it —
  // never cut into holes, which is not how fresh foam looks
  const veil = mix(float(VEIL_THINNEST), float(1.0), grain.x);

  // Behind it: a coarser lace whose holes open as it spreads, until only the
  // thickest strands are left
  const lace = smoothstep(SPREAD_OPENNESS - LACE_SOFTNESS, SPREAD_OPENNESS + LACE_SOFTNESS, grain.y);

  // The outermost edge fades out, so the foam never ends in a line — in
  // front, over a longer way, as the gathering foam thins to nothing
  const fadeLength = mix(float(FULL_WHITECAP * FRONT_FADE_LONGER), float(FULL_WHITECAP), behind);
  const body = smoothstep(0.0, fadeLength, whitecaps);

  return body.mul(mix(lace, veil, fresh)).mul(MAX_FOAM_DENSITY);
}

/**
 * The colour foam has at a point: its own colour, darker where the surface
 * faces away from the light, as the water is.
 */
export function crestFoamColor(foamColor: Node<"vec3">, normal: Node<"vec3">, lightDirection: Node<"vec3">) {
  const lit = max(dot(normal, lightDirection), 0.0);
  const brightness = mix(float(SHADED_FOAM_BRIGHTNESS), float(1.0), lit);

  return foamColor.mul(vec3(brightness));
}
