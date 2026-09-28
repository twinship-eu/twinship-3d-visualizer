/**
 * Seascape — 3. Lighting
 *
 * How a point on the sea is coloured once we know where it is and which way it
 * faces. Shared by both versions: the raymarched background and the
 * world-space surface.
 *
 * Names in the original GLSL:
 *   sky_color  -> skyColor
 *   sea_color  -> seaColor
 *   diffuse    -> diffuseLight
 *   specular   -> specularLight
 *   the end of main() -> shadeSea
 */
import { add, dot, float, Fn, max, mix, normalize, pow, reflect, smoothstep, sub, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { WAVES_AMPLITUDE } from "./seascape-waves";

// Colours (the GLSL SEA_BASE, SEA_WATER_COLOR, SKY_INTENSITY). The Shadertoy's
// values; the raymarched background keeps them, the surface can retint them.
/** The colour of deep water, facing away from the sky. */
export const SHADERTOY_DEEP_COLOR = vec3(0.1, 0.19, 0.22);
/** The light green-yellow the wave crests and sunlit faces pick up. */
export const SHADERTOY_LIGHT_COLOR = vec3(0.8, 0.9, 0.6);
const SKY_INTENSITY = 1.0;

/**
 * How much of the sky the water reflects when seen edge-on — the most the
 * Fresnel term reaches. The Shadertoy's value; the raymarched background keeps
 * it, the surface can raise it.
 */
export const SHADERTOY_REFLECTIVITY = 0.65;

/**
 * The Shadertoy's highlight: broad, one soft patch of sun. The specular is
 * energy conserving, so a higher shininess gives smaller, brighter glints with
 * the same light overall.
 */
export const SHADERTOY_SHININESS = 60.0;

/** The Shadertoy's final gamma lift, applied to sea and sky alike. */
const SEASCAPE_GAMMA = 0.75;

/**
 * The slight gamma lift the Shadertoy applies to every pixel, per channel.
 * Shared so the sky behind the sea goes through exactly the same curve.
 */
export function gammaLift(color: Node<"vec3">) {
  return vec3(pow(color.x, SEASCAPE_GAMMA), pow(color.y, SEASCAPE_GAMMA), pow(color.z, SEASCAPE_GAMMA));
}

/**
 * The Shadertoy's light: above, and slightly behind its camera. The raymarched
 * background keeps it; the surface uses the scene's sun instead.
 */
export const LIGHT_DIRECTION = normalize(vec3(0.0, 1.0, 0.8));

/**
 * The sky in a given direction: white at the horizon, blue straight up.
 * Directions below the horizon get the horizon colour.
 */
export const skyColor = Fn(
  ([direction]: [Node<"vec3">]) => {
    const height = max(direction.y, 0.0);
    const towardsHorizon = sub(1.0, height);

    const sky = vec3(pow(towardsHorizon, 2.0), towardsHorizon, add(0.6, towardsHorizon.mul(0.4)));

    return sky.mul(SKY_INTENSITY);
  },
  { direction: "vec3", return: "vec3" }
);

// A clear sky, for the surface sea: the Shadertoy's is nearly white for a wide
// band above the horizon, and at an ordinary camera height most reflected rays
// land in that band — every small tilt of the water flipped the reflection
// between white and blue, and the sea filled with reflected "clouds".
/** Straight up: a deep, clear blue. */
const CLEAR_SKY_ZENITH = vec3(0.16, 0.38, 0.75);
/** At the horizon: a pale, hazy blue. */
const CLEAR_SKY_HORIZON = vec3(0.62, 0.76, 0.9);
/** How close to the horizon the pale band stays: higher keeps it thinner. */
const CLEAR_SKY_HORIZON_POWER = 4.0;

/**
 * Real water's reflectance looking straight down (Schlick's F0 for a
 * refractive index of 1.33). The surface uses Schlick's Fresnel,
 * F0 + (1 - F0)(1 - cos)^5: about 2% of the sky looking down, rising steeply
 * only at grazing angles. The Shadertoy's (1 - cos)^3 reflects two to three
 * times more at the angles a camera usually sees.
 */
const WATER_REFLECTANCE_AT_NORMAL = 0.02;

/**
 * The clear sky in a given direction: deep blue overhead, pale towards the
 * horizon. Directions below the horizon get the horizon colour.
 */
export const clearSkyColor = Fn(
  ([direction]: [Node<"vec3">]) => {
    const towardsHorizon = pow(sub(1.0, max(direction.y, 0.0)), CLEAR_SKY_HORIZON_POWER);

    return mix(CLEAR_SKY_ZENITH, CLEAR_SKY_HORIZON, towardsHorizon);
  },
  { direction: "vec3", return: "vec3" }
);

/**
 * The water's own colour: deep blue-green, reflecting more of the sky at
 * grazing angles, with crests lightened near the viewer.
 *
 * `clearSky` picks the sky model: 0 is the Shadertoy's (its sky and its
 * Fresnel, for the raymarched background), 1 the surface's — the clear sky,
 * Schlick's Fresnel, and reflected rays that dip below the horizon turned back
 * up, as they would bounce off the next wave rather than see the sky below.
 */
export const seaColor = Fn(
  ([point, normal, viewDirection, toPoint, reflectivity, deepColor, lightColor, clearSky]: [
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"float">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"float">,
  ]) => {
    // Fresnel: water facing the viewer shows its depth; water seen edge-on
    // reflects the sky
    const facingAway = sub(1.0, max(dot(normal, viewDirection.negate()), 0.0));
    const shadertoyFresnel = pow(facingAway, 3.0);
    const schlickFresnel = pow(facingAway, 5.0)
      .mul(1.0 - WATER_REFLECTANCE_AT_NORMAL)
      .add(WATER_REFLECTANCE_AT_NORMAL);
    const fresnel = mix(shadertoyFresnel, schlickFresnel, clearSky).mul(reflectivity);

    const reflected = reflect(viewDirection, normal);
    const turnedUp = vec3(reflected.x, reflected.y.abs(), reflected.z);
    const reflection = mix(skyColor(reflected), clearSkyColor(turnedUp), clearSky);
    const color = mix(deepColor, reflection, fresnel).toVar();

    // Crests above the mean level catch light. Faded with distance so the far
    // sea does not glitter
    const distanceFade = max(sub(1.0, dot(toPoint, toPoint).mul(0.001)), 0.0);
    const aboveMeanLevel = point.y.sub(WAVES_AMPLITUDE);
    color.addAssign(lightColor.mul(aboveMeanLevel).mul(0.18).mul(distanceFade));

    return color;
  },
  {
    point: "vec3",
    normal: "vec3",
    viewDirection: "vec3",
    toPoint: "vec3",
    reflectivity: "float",
    deepColor: "vec3",
    lightColor: "vec3",
    clearSky: "float",
    return: "vec3",
  }
);

/**
 * "Wrapped" diffuse: never fully dark on the side facing away, which suits a
 * translucent surface like water. Raised to `sharpness` to keep it to the
 * faces pointing at the light.
 */
export const diffuseLight = Fn(
  ([normal, lightDirection, sharpness]: [Node<"vec3">, Node<"vec3">, Node<"float">]) => {
    return pow(dot(normal, lightDirection).mul(0.4).add(0.6), sharpness);
  },
  { normal: "vec3", lightDirection: "vec3", sharpness: "float", return: "float" }
);

/**
 * Phong specular highlight, scaled so a sharper highlight is also a brighter
 * one (energy conserving).
 */
export const specularLight = Fn(
  ([normal, lightDirection, viewDirection, shininess]: [
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"float">,
  ]) => {
    const normalization = shininess.add(8.0).div(3.1415 * 8.0);
    const reflected = reflect(viewDirection, normal);

    return pow(max(dot(reflected, lightDirection), 0.0), shininess).mul(normalization);
  },
  { normal: "vec3", lightDirection: "vec3", viewDirection: "vec3", shininess: "float", return: "float" }
);

/**
 * The final colour of a point on the sea — the end of the GLSL `main()`.
 *
 * @param point         the point on the sea, in sea space
 * @param normal        which way the surface faces there
 * @param viewDirection from the eye towards the point
 * @param toPoint       from the eye to the point, not normalised
 * @param reflectivity  how much sky edge-on water reflects — see SHADERTOY_REFLECTIVITY
 * @param deepColor     the water's own colour, where it reflects no sky
 * @param lightColor    the tint crests and sunlit faces pick up
 * @param lightDirection towards the light — see LIGHT_DIRECTION
 * @param shininess     how tight the sun's highlight is — see SHADERTOY_SHININESS
 * @param subsurface    light shining through the water, added before the
 *                      horizon fade and the gamma lift, like the rest
 * @param clearSky      0 the Shadertoy's sky and Fresnel, 1 the clear sky — see seaColor
 * @param reflectionNormal the normal the sky's reflection and the Fresnel see;
 *                      the Shadertoy passes `normal` again. The surface passes
 *                      one with little of the short chop — see its fragment shader
 */
export const shadeSea = Fn(
  ([
    point,
    normal,
    viewDirection,
    toPoint,
    reflectivity,
    deepColor,
    lightColor,
    lightDirection,
    shininess,
    subsurface,
    clearSky,
    reflectionNormal,
  ]: [
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"float">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"float">,
    Node<"vec3">,
    Node<"float">,
    Node<"vec3">,
  ]) => {
    // Water colour, plus a little diffuse light and the sun's highlight
    const color = seaColor(
      point,
      reflectionNormal,
      viewDirection,
      toPoint,
      reflectivity,
      deepColor,
      lightColor,
      clearSky
    ).toVar();
    color.addAssign(lightColor.mul(diffuseLight(normal, lightDirection, 80.0)).mul(0.12));
    color.addAssign(specularLight(normal, lightDirection, viewDirection, shininess));
    color.addAssign(subsurface);

    // Fade into the sky right at the horizon. The GLSL writes this as
    // smoothstep(0.0, -0.05, y); WGSL rejects reversed edges when they are
    // constants, and 1 - smoothstep(-0.05, 0.0, y) is the same curve.
    //
    // Only for the raymarched background (clearSky 0), where a ray pointing up
    // meant sky. On the surface, a crest higher than the camera is seen along a
    // ray pointing up too — and was painted over with the sky: grey wave tops,
    // more of them the bigger the waves and the lower the camera. The surface's
    // distance is hazed by the scene's fog instead.
    const horizonFade = pow(smoothstep(-0.05, 0.0, viewDirection.y).oneMinus(), 0.3);
    color.assign(mix(skyColor(viewDirection), color, mix(horizonFade, float(1.0), clearSky)));

    return vec4(gammaLift(color), 1.0);
  },
  {
    point: "vec3",
    normal: "vec3",
    viewDirection: "vec3",
    toPoint: "vec3",
    reflectivity: "float",
    deepColor: "vec3",
    lightColor: "vec3",
    lightDirection: "vec3",
    shininess: "float",
    subsurface: "vec3",
    clearSky: "float",
    reflectionNormal: "vec3",
    return: "vec4",
  }
);
