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
import { add, dot, Fn, max, mix, normalize, pow, reflect, smoothstep, sub, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { WAVES_AMPLITUDE } from "./seascape-waves";

// Colours (the GLSL SEA_BASE, SEA_WATER_COLOR, SKY_INTENSITY)
/** The colour of deep water, facing away from the sky. */
const SEA_DEEP_COLOR = vec3(0.1, 0.19, 0.22);
/** The light green-yellow the wave crests and sunlit faces pick up. */
const SEA_LIGHT_COLOR = vec3(0.8, 0.9, 0.6);
const SKY_INTENSITY = 1.0;

/** Direction the light comes from: above, and slightly behind the camera. */
const LIGHT_DIRECTION = normalize(vec3(0.0, 1.0, 0.8));

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

/**
 * The water's own colour: deep blue-green, reflecting more of the sky at
 * grazing angles, with crests lightened near the viewer.
 */
export const seaColor = Fn(
  ([point, normal, viewDirection, toPoint]: [
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
  ]) => {
    // Fresnel: water facing the viewer shows its depth; water seen edge-on
    // reflects the sky
    const facingAway = sub(1.0, max(dot(normal, viewDirection.negate()), 0.0));
    const fresnel = pow(facingAway, 3.0).mul(0.65);
    const reflection = skyColor(reflect(viewDirection, normal));
    const color = mix(SEA_DEEP_COLOR, reflection, fresnel).toVar();

    // Crests above the mean level catch light. Faded with distance so the far
    // sea does not glitter
    const distanceFade = max(sub(1.0, dot(toPoint, toPoint).mul(0.001)), 0.0);
    const aboveMeanLevel = point.y.sub(WAVES_AMPLITUDE);
    color.addAssign(SEA_LIGHT_COLOR.mul(aboveMeanLevel).mul(0.18).mul(distanceFade));

    return color;
  },
  { point: "vec3", normal: "vec3", viewDirection: "vec3", toPoint: "vec3", return: "vec3" }
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
 */
export const shadeSea = Fn(
  ([point, normal, viewDirection, toPoint]: [
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
    Node<"vec3">,
  ]) => {
    // Water colour, plus a little diffuse light and the sun's highlight
    const color = seaColor(point, normal, viewDirection, toPoint).toVar();
    color.addAssign(SEA_LIGHT_COLOR.mul(diffuseLight(normal, LIGHT_DIRECTION, 80.0)).mul(0.12));
    color.addAssign(specularLight(normal, LIGHT_DIRECTION, viewDirection, 60.0));

    // Fade into the sky right at the horizon. The GLSL writes this as
    // smoothstep(0.0, -0.05, y); WGSL rejects reversed edges when they are
    // constants, and 1 - smoothstep(-0.05, 0.0, y) is the same curve.
    const horizonFade = pow(smoothstep(-0.05, 0.0, viewDirection.y).oneMinus(), 0.3);
    color.assign(mix(skyColor(viewDirection), color, horizonFade));

    // Slight gamma lift, per channel
    const gamma = 0.75;
    return vec4(pow(color.x, gamma), pow(color.y, gamma), pow(color.z, gamma), 1.0);
  },
  { point: "vec3", normal: "vec3", viewDirection: "vec3", toPoint: "vec3", return: "vec4" }
);
