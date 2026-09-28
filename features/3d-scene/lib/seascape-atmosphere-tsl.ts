/**
 * Seascape — 5. Atmosphere
 *
 * The sky behind the surface sea, and the haze between the two.
 *
 * Why this exists: the grid the sea is drawn on ends 800 units from the
 * camera, and behind it was a different sky from the one the water reflects —
 * so from far away the sea read as a slab with an edge, sitting in front of a
 * backdrop from another scene. Real seas have no edge because the air hides it:
 * the further the water, the more it turns into the colour of the horizon.
 *
 * Both halves here meet at one colour, `horizonColor`:
 * - the haze fades the sea (and the ship) into it with distance, reaching it
 *   fully before the grid runs out, so the edge is never seen;
 * - the sky fades into it towards the horizon, and below the horizon — where
 *   the space between the grid's edge and the horizon line shows — it is that
 *   colour exactly.
 * Where the two meet, both are `horizonColor`, so there is no seam to find.
 */
import {
  vec3,
  positionWorld,
  cameraPosition,
  float,
  fog,
  length,
  max,
  mix,
  normalize,
  normalWorldGeometry,
  positionView,
  smoothstep,
  uniform,
  vec4,
} from "three/tsl";
import { Color } from "three/webgpu";
import { withClouds } from "./seascape-clouds";
import { overcast, precipitation } from "./seascape-weather";
import { clearSkyColor, gammaLift } from "./seascape-lighting";
import { underwater, underwaterColor, underwaterFogFactor } from "./seascape-underwater";

type AtmosphereOptions = {
  /** Horizon colour, as a CSS colour string. */
  horizonColor: string;
  /** Distance from the camera where the haze starts, in world units. */
  hazeStart: number;
  /** Distance where the haze is complete. Must be inside the sea grid. */
  hazeEnd: number;
  /** How high above the horizon the sky is still tinted by the haze, as the y of a direction (0-1). */
  skyHazeHeight: number;
};

/** The horizon under a closed sky: grey. */
const OVERCAST_HORIZON = vec3(0.6, 0.63, 0.67);
/**
 * In rain or snow the haze closes in: to this share of its reach in a
 * downpour, and it climbs the sky to this height of the view.
 */
const STORM_HAZE_REACH = 0.35;
const STORM_SKY_HAZE_HEIGHT = 0.45;

/** Smallest gap between two smoothstep edges, so they can never coincide at runtime. */
const MIN_EDGE_GAP = 1e-3;

export function createSeascapeAtmosphereNodes(options: AtmosphereOptions) {
  /**
   * Live knobs, driven by the Inspector's "Atmosphere" panel. Uniforms, so the
   * look changes without the shaders being rebuilt.
   */
  const uniforms = {
    horizonColor: uniform(new Color(options.horizonColor)),
    hazeStart: uniform(options.hazeStart),
    hazeEnd: uniform(options.hazeEnd),
    skyHazeHeight: uniform(options.skyHazeHeight),
  };

  /**
   * The sky: the same clear sky the water reflects, through the same gamma
   * lift, fading into the horizon colour near and below the horizon.
   *
   * three draws a background node on a sphere around the camera, so the
   * sphere's own normal is the direction being looked in.
   */
  const direction = normalize(normalWorldGeometry);
  const sky = withClouds(gammaLift(clearSkyColor(direction, overcast())), direction);
  // The horizon greys with the clouds, and the haze thickens and closes in
  // with rain or snow in the air
  const horizon = mix(vec3(uniforms.horizonColor), OVERCAST_HORIZON, overcast()).toVar();
  const hazeHeight = mix(max(uniforms.skyHazeHeight, MIN_EDGE_GAP), float(STORM_SKY_HAZE_HEIGHT), precipitation());
  const skyHaze = smoothstep(0.0, hazeHeight, direction.y).oneMinus();
  // Under the water (`underwater.submerged`), the water's murk replaces the sky
  const airBackground = mix(sky, horizon, skyHaze);
  const backgroundNode = vec4(mix(airBackground, underwaterColor(direction), underwater.submerged), 1.0);

  /**
   * The haze: by straight-line distance from the camera, not by depth. Depth
   * (three's default) is shorter towards the sides of the screen, so the
   * grid's edge there would be less hazed than straight ahead — and would show.
   */
  const distance = length(positionView);
  const closing = mix(float(1.0), float(STORM_HAZE_REACH), precipitation());
  const hazeStart = uniforms.hazeStart.mul(closing);
  const hazeEnd = max(uniforms.hazeEnd.mul(closing), hazeStart.add(float(MIN_EDGE_GAP)));
  const airFog = smoothstep(hazeStart, hazeEnd, distance);

  // ...and closes in within tens of metres, lighter looking up, darker down
  const lookingAt = normalize(positionWorld.sub(cameraPosition));
  const fogNode = fog(
    mix(horizon, underwaterColor(lookingAt), underwater.submerged),
    mix(airFog, underwaterFogFactor(), underwater.submerged)
  );

  return { backgroundNode, fogNode, uniforms };
}
