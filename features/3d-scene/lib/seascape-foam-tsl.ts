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
const GRAIN_STRETCH = 4.0;
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
 * The grain's range: the foam's density between its strands, and the texture
 * values over which it rises to full. Thin between the strands, so the water
 * shows through and the foam reads as streaks, not a white sheet — as seen in
 * storm footage and the reference.
 */
const GRAIN_FLOOR = 0.15;
const GRAIN_START = 0.2;
const GRAIN_FULL = 0.85;

/**
 * Whitecap amount at which the foam is at its thickest; it eases in below, and
 * is half as thick at VISIBLE_WHITECAP — where the wind's coverage is measured.
 */
const FULL_WHITECAP = VISIBLE_WHITECAP * 2;
// (The whitecaps' own edge is already frayed by the grain — `windSeaWhitecaps`.)

/**
 * How opaque the thickest foam gets: a little water always shows through.
 * (0.6 left the streaks too faint to read as foam at the default zoom.)
 */
const MAX_FOAM_DENSITY = 0.75;

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

  return fineTexel.add(coarseTexel).mul(0.5);
}

/**
 * How much foam covers a point, from 0 to MAX_FOAM_DENSITY, given how much
 * whitecap foam lies there (`windSeaWhitecaps`) and the grain (`foamGrain`).
 */
export function crestFoamDensity(whitecaps: Node<"float">, grain: Node<"float">) {
  // 1. The body: eased in
  const body = smoothstep(0.0, FULL_WHITECAP, whitecaps);

  // 2. The grain shades the body, from thin foam to thick
  const thickness = mix(float(GRAIN_FLOOR), float(1.0), smoothstep(GRAIN_START, GRAIN_FULL, grain));

  return body.mul(thickness).mul(MAX_FOAM_DENSITY);
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
