/**
 * Seascape — 22. The ship's shadow on the water
 *
 * The sea lights itself, so three's own shadow lookup does not reach it. It
 * reads the sun's shadow map instead — the one the ship's lighting already
 * draws, so this costs a few texture reads and no second shadow pass. The map
 * does not exist when the sea's shader is built (the light draws it with its
 * first frame): a one-texel stand-in is bound until `updateSeaShadow` swaps in
 * the real one, and until then the sea is in full sun.
 */
import { float, texture, uniform, vec2, vec4 } from "three/tsl";
import { DepthTexture, FloatType, LessEqualCompare, LinearFilter, Matrix4, RenderTarget, Vector2, type DirectionalLight, type Node } from "three/webgpu";

/** How far in front of the caster's depth a point must be to be lit, in the map's 0-1 depth: kills acne on the flat water. */
const DEPTH_BIAS = 0.0006;

// As the light's own depth texture is set up (ShadowNode): compared by the
// hardware, filtered between texels. It belongs to a render target, as the
// light's does — a depth texture without one is taken for the scene's own, and
// as multisampled, and the real map would not fit its binding.
const standIn = new DepthTexture(1, 1, FloatType);
standIn.compareFunction = LessEqualCompare;
standIn.minFilter = LinearFilter;
standIn.magFilter = LinearFilter;
const standInTarget = new RenderTarget(1, 1);
standInTarget.depthTexture = standIn;

/** Every lookup of the map: each is its own texture node, and is given the real map when there is one. */
const lookups: ReturnType<typeof texture>[] = [];
const uniforms = {
  /** World to the shadow map's clip space: the light's own. */
  matrix: uniform(new Matrix4()),
  /** Texels across the map, for the soft edge. */
  mapSize: uniform(new Vector2(2048, 2048)),
  /** 1 once the real map is bound. */
  isReady: uniform(0),
};

/** Binds the sun's shadow map once the light has drawn it; each frame, cheaply. */
export function updateSeaShadow(light: DirectionalLight) {
  const map = light.shadow.map;
  if (!map?.depthTexture) return;
  for (const lookup of lookups) lookup.value = map.depthTexture;
  uniforms.matrix.value.copy(light.shadow.matrix);
  uniforms.mapSize.value.set(light.shadow.mapSize.width, light.shadow.mapSize.height);
  uniforms.isReady.value = 1;
}

/** How much of the sun reaches a point in the world: 0 in the ship's shadow, 1 in the sun, soft at the edge. */
export function seaSunVisibility(position: Node<"vec3">) {
  const clip = uniforms.matrix.mul(vec4(position, 1.0));
  const coord = clip.xyz.div(clip.w);
  // WebGPU's texture origin is the top: the map's y runs the other way
  const at = vec2(coord.x, coord.y.oneMinus());
  const depth = coord.z.add(DEPTH_BIAS);
  const texel = vec2(1.0).div(uniforms.mapSize);
  const tap = (offset: Node<"vec2">) => {
    const lookup = texture(standIn, at.add(offset.mul(texel)));
    lookups.push(lookup);
    return float(lookup.compare(depth));
  };
  // Two taps a texel apart, each already filtered between four texels: the edge of a shadow is soft, not stepped
  const shadowed = tap(vec2(-0.5, -0.5)).add(tap(vec2(0.5, 0.5))).mul(0.5);
  const isInside = at.x
    .greaterThan(0.0)
    .and(at.x.lessThan(1.0))
    .and(at.y.greaterThan(0.0))
    .and(at.y.lessThan(1.0))
    .and(coord.z.lessThan(1.0));

  return isInside.and(uniforms.isReady.greaterThan(0.5)).select(shadowed, float(1.0));
}
