/**
 * Seascape — 4a. Raymarched background
 *
 * The original Shadertoy (https://www.shadertoy.com/view/Ms2SD1) as a
 * full-screen background: for every pixel, shoot a ray from an imaginary
 * camera, find where it meets the sea, and shade that point.
 *
 * It looks exactly like the original, but the imaginary camera is not the
 * scene's camera and the sea has no depth, so nothing can sit in it. See
 * `seascape-surface-tsl.ts` for the version the ship can go into.
 *
 * Porting notes — where this differs from the GLSL, and why:
 * - Converted first with three's own Transpiler (r183), then rewritten for
 *   readability with the same maths. The transpiler's output crashed or
 *   rendered wrongly in several places; those are fixed here.
 * - `hftracing` wrote its hit point into an `out` parameter. TSL never builds a
 *   call whose result goes unused, so that write disappeared and the sea came
 *   out flat. `traceSea` returns the hit point instead.
 * - The time is passed down as a parameter, never read inside a function —
 *   see the rule at the top of `seascape-waves.ts`.
 * - The reversed `smoothstep` at the horizon is rewritten — see `shadeSea`.
 * - Unused code in the original (the mouse, `fromEuler`, `rotate`) is dropped.
 */
import {
  dot,
  float,
  Fn,
  If,
  length,
  Loop,
  mix,
  normalize,
  screenSize,
  screenUV,
  time,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { SHADERTOY_REFLECTIVITY, shadeSea } from "./seascape-lighting";
import { seaElevation, seaSlopeDetailed, WAVES_SPEED } from "./seascape-waves";

// Tracing (the GLSL NUM_STEPS and the 1000.0 in hftracing)
/** Refinement steps once a ray is known to hit the sea. */
const TRACE_STEPS = 8;
/** Furthest distance a ray is traced. */
const TRACE_DISTANCE = 1000.0;

// Imaginary camera
/** Eye height above the sea. */
const CAMERA_HEIGHT = 3.5;
/** How fast the camera drifts forward. */
const CAMERA_DRIFT_SPEED = 0.05;
/** Distance to the image plane: smaller gives a wider field of view. */
const CAMERA_FOCAL_LENGTH = 2.0;

/**
 * How far above the sea a point is: positive above the water, negative below.
 * (The GLSL `map`.)
 */
const heightAboveSea = Fn(
  ([point, seaTime]: [Node<"vec3">, Node<"float">]) => {
    return point.y.sub(seaElevation(point.xz, seaTime));
  },
  { point: "vec3", seaTime: "float", return: "float" }
);

/**
 * Where a ray first meets the sea. (The GLSL `hftracing`.)
 *
 * No fixed-step marching: once the ray is known to start above the water and
 * end below it, the crossing is narrowed down by guessing where a straight
 * line between the two heights would cross zero — the regula falsi method.
 */
const traceSea = Fn(([origin, direction, seaTime]: [Node<"vec3">, Node<"vec3">, Node<"float">]) => {
  // By default, the point as far as the ray goes
  const hit = origin.add(direction.mul(TRACE_DISTANCE)).toVar();

  const farDistance = float(TRACE_DISTANCE).toVar();
  const heightAtFar = heightAboveSea(hit, seaTime).toVar();

  // A ray still above the water at its far end never meets the sea: that is
  // the sky, and the default point is fine
  If(heightAtFar.lessThanEqual(0.0), () => {
    const nearDistance = float(0.0).toVar();
    const heightAtNear = heightAboveSea(origin, seaTime).toVar();

    Loop(TRACE_STEPS, () => {
      // Where would the surface be if it were a straight line between the two?
      const guessDistance = mix(
        nearDistance,
        farDistance,
        heightAtNear.div(heightAtNear.sub(heightAtFar))
      ).toVar();
      hit.assign(origin.add(direction.mul(guessDistance)));
      const heightAtGuess = heightAboveSea(hit, seaTime).toVar();

      // Keep whichever half still contains the crossing
      If(heightAtGuess.lessThan(0.0), () => {
        farDistance.assign(guessDistance);
        heightAtFar.assign(heightAtGuess);
      }).Else(() => {
        nearDistance.assign(guessDistance);
        heightAtNear.assign(heightAtGuess);
      });
    });
  });

  return hit;
});

/**
 * The background's colour for the current pixel — the GLSL `main()`.
 */
export const seascapeBackgroundColor = Fn(() => {
  const seaTime = time.mul(WAVES_SPEED);

  // Pixel position on an image plane in front of the camera, [-1, 1] on y.
  // The original mirrors x (`uv = 1.0 - uv * 2.0`); kept so the image matches.
  const aspect = screenSize.x.div(screenSize.y);
  const screen = vec2(
    float(1.0).sub(screenUV.x.mul(2.0)).mul(aspect),
    float(1.0).sub(screenUV.y.mul(2.0))
  );

  // Ray from the imaginary camera through that pixel. The original pushes the
  // edges of the image a little further away, and does not renormalise after.
  const origin = vec3(0.0, CAMERA_HEIGHT, time.mul(CAMERA_DRIFT_SPEED));
  const straight = normalize(vec3(screen, -CAMERA_FOCAL_LENGTH));
  const direction = vec3(straight.x, straight.y, straight.z.sub(length(screen).mul(0.15)));

  // Where it meets the sea
  const hit = traceSea(origin, direction, seaTime);
  const toPoint = hit.sub(origin);

  // Which way the sea faces there. The slope is measured over a larger patch
  // further away (the GLSL EPSILON_NRM), so the distance stays calm
  const slopeStep = dot(toPoint, toPoint).mul(float(0.1).div(screenSize.x));
  const slope = seaSlopeDetailed(hit.xz, slopeStep, seaTime);
  const normal = normalize(vec3(slope.x.negate(), 1.0, slope.y.negate()));

  return shadeSea(hit, normal, direction, toPoint, SHADERTOY_REFLECTIVITY);
});
