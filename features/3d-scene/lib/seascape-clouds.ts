/**
 * Seascape — 18. Clouds
 *
 * A few small fair-weather clouds on the sky behind the sea: a thin layer of
 * noise over the sky, seen through its cells' highest parts only, so they come
 * out sparse and scattered. They drift slowly, and fade into the haze near the
 * horizon.
 */
import { max, mix, smoothstep, time, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { valueNoise } from "./seascape-noise";

/** Size of a cloud on the layer, in the layer's units: small puffs. */
const CLOUD_SCALE = 3.2;
/**
 * Noise values where a cloud starts and where it is solid: only the highest —
 * the noise averages 0.5, so these leave a few scattered puffs.
 */
const CLOUD_START = 0.64;
const CLOUD_FULL = 0.82;
/** How fast they drift across the sky, in layer units per second. */
const CLOUD_DRIFT = vec2(0.004, 0.0015);
/** Near the horizon the layer is seen edge-on; below this height of the view it fades out. */
const HORIZON_FADE_START = 0.04;
const HORIZON_FADE_FULL = 0.2;
/** How opaque the thickest cloud gets, and its colours: sunlit tops, a greyer base. */
const MAX_COVER = 0.85;
const CLOUD_LIT = vec3(1.0, 1.0, 1.0);
const CLOUD_SHADE = vec3(0.78, 0.82, 0.88);

/**
 * The sky with clouds over it, looking in `direction`.
 *
 * @param sky the sky's colour there, without clouds
 */
export function withClouds(sky: Node<"vec3">, direction: Node<"vec3">) {
  // The layer as a flat ceiling: where the view meets it, in its own units
  const height = max(direction.y, 0.02);
  const onLayer = direction.xz.div(height).add(CLOUD_DRIFT.mul(time));
  const at = onLayer.mul(CLOUD_SCALE);

  // Puffs with ragged edges: two octaves of noise
  const shape = valueNoise(at)
    .mul(0.65)
    .add(valueNoise(at.mul(2.7).add(vec2(5.3, 1.9))).mul(0.35))
    .mul(0.5)
    .add(0.5);
  const cover = smoothstep(CLOUD_START, CLOUD_FULL, shape)
    .mul(smoothstep(HORIZON_FADE_START, HORIZON_FADE_FULL, direction.y))
    .mul(MAX_COVER);

  // Thicker middles are brighter on top: a hint of shading towards the edges
  const cloudColor = mix(CLOUD_SHADE, CLOUD_LIT, smoothstep(CLOUD_START, 1.0, shape));

  return mix(sky, cloudColor, cover);
}
