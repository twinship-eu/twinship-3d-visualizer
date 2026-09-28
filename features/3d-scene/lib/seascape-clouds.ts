/**
 * Seascape — 18. Clouds
 *
 * A few small fair-weather clouds on the sky behind the sea: a thin layer of
 * noise over the sky, seen through its cells' highest parts only, so they come
 * out sparse and scattered. They drift slowly, and fade into the haze near the
 * horizon.
 */
import { float, max, mix, smoothstep, time, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { valueNoise } from "./seascape-noise";
import { overcast, weather } from "./seascape-weather";

/** Size of a cloud on the layer, in the layer's units: small puffs. */
const CLOUD_SCALE = 3.2;
/**
 * Noise values where a cloud starts, in fair weather and overcast: only the
 * highest (the noise averages 0.5) for a few scattered puffs, nearly all of it
 * for a closed deck. `weather.cloudCover` moves between the two. A cloud is
 * solid CLOUD_SOLIDITY above where it starts.
 */
const FAIR_CLOUD_START = 0.64;
const OVERCAST_CLOUD_START = 0.12;
const CLOUD_SOLIDITY = 0.18;
/** The cloud deck's greys, overcast and with rain in it: heavy, darker undersides. */
const OVERCAST_LIT = vec3(0.72, 0.75, 0.78);
const OVERCAST_SHADE = vec3(0.5, 0.53, 0.57);
const RAIN_SHADE = vec3(0.36, 0.39, 0.43);
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
  const start = mix(float(FAIR_CLOUD_START), float(OVERCAST_CLOUD_START), weather.cloudCover);
  const cover = smoothstep(start, start.add(CLOUD_SOLIDITY), shape)
    .mul(smoothstep(HORIZON_FADE_START, HORIZON_FADE_FULL, direction.y))
    .mul(mix(float(MAX_COVER), float(1.0), overcast()));

  // Thicker middles are brighter on top: a hint of shading towards the edges.
  // Greyer and heavier as the sky closes, darkest with rain
  const grey = overcast();
  const lit = mix(CLOUD_LIT, OVERCAST_LIT, grey);
  const shade = mix(mix(CLOUD_SHADE, OVERCAST_SHADE, grey), RAIN_SHADE, weather.rain);
  const cloudColor = mix(shade, lit, smoothstep(start, 1.0, shape));

  return mix(sky, cloudColor, cover);
}
