/**
 * Seascape — 21. The sky of the hour
 *
 * What the time of day adds to the clear sky behind the sea: the glow along
 * the horizon at dusk and dawn, the stars at night, and the sun itself — a
 * disc far brighter than white, so the bloom catches it, with the glare round
 * it. All of it follows `sky-state.ts`, and the clouds cover it as they cover
 * the sky: a sun behind a cloud is a dim patch, not a disc.
 */
import { dot, float, floor, fract, max, mix, normalize, pow, sin, smoothstep, step, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { cloudsAt } from "./seascape-clouds";
import { clearSkyColor, gammaLift } from "./seascape-lighting";
import { skyUniforms } from "./sky-state";
import { overcast } from "./seascape-weather";

/** The sun's disc: the dot of a direction with the sun's at which it ends, and where it is full. */
const DISC_EDGE = 0.999975;
const DISC_FULL = 0.999992;
/** How much brighter than white the disc is: the bloom's, past the tone mapping. */
const DISC_BRIGHTNESS = 7;
/** The glare round the sun: tight and bright, and wide and faint — power, and strength. */
const GLARE_TIGHT = { power: 600, strength: 1.6 };
const GLARE_WIDE = { power: 22, strength: 0.55 };
/** A sun under the horizon, or on it, is not seen: heights of the view over which it is let in. */
const HORIZON_SUN_FROM = -0.01;
const HORIZON_SUN_FULL = 0.012;

/** The horizon's glow at dusk: how far up the sky it climbs, and how much it keeps away from the sun. */
const GLOW_HEIGHT_POWER = 1.6;
const GLOW_AWAY_FROM_SUN = 0.25;
const GLOW_STRENGTH = 1.4;
/** An overcast sky keeps this share of the glow less. */
const GLOW_CLOUDED_LOSS = 0.6;

/** The stars: cells to a unit of direction, the share of cells that hold one, how bright. */
const STAR_CELLS = 140;
const STAR_RARITY = 0.9965;
const STAR_BRIGHTNESS = 2.4;
/** Below this height of the view the horizon hides the stars; the full sky from this one. */
const STARS_FROM_HORIZON = 0.02;
const STARS_FULL = 0.2;

/** A hash of a cell to 0-1. */
const hash = (cell: Node<"vec3">) => fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));

/** The stars in a direction, turned with the ship so they stay where the sun is. */
function starsAt(direction: Node<"vec3">) {
  const cos = skyUniforms.turn.cos();
  const sinTurn = skyUniforms.turn.sin();
  const turned = vec3(direction.x.mul(cos).sub(direction.z.mul(sinTurn)), direction.y, direction.x.mul(sinTurn).add(direction.z.mul(cos)));
  const scaled = turned.mul(STAR_CELLS);
  const cell = floor(scaled);
  const inCell = fract(scaled).sub(0.5);
  const seed = hash(cell);
  const brightness = hash(cell.add(vec3(7.0, 3.0, 11.0))).mul(0.6).add(0.4);
  const centre = vec3(hash(cell.add(vec3(1.0, 5.0, 9.0))), hash(cell.add(vec3(4.0, 2.0, 6.0))), hash(cell.add(vec3(8.0, 1.0, 3.0)))).sub(0.5).mul(0.6);
  const point = float(1.0).sub(smoothstep(0.0, 0.32, inCell.sub(centre).length()));
  const height = smoothstep(STARS_FROM_HORIZON, STARS_FULL, direction.y);

  return vec3(0.85, 0.9, 1.0).mul(step(STAR_RARITY, seed).mul(point).mul(brightness).mul(STAR_BRIGHTNESS)).mul(height);
}

/** The sky's glow at the sun's side of the horizon at dusk and dawn. */
function glowAt(direction: Node<"vec3">) {
  const sunSide = normalize(skyUniforms.sunDirection.xz.add(1e-4));
  const side = max(dot(normalize(direction.xz.add(1e-4)), sunSide), 0.0);
  const towardsHorizon = pow(float(1.0).sub(max(direction.y, 0.0)), GLOW_HEIGHT_POWER);
  const reach = float(GLOW_AWAY_FROM_SUN).add(float(1.0 - GLOW_AWAY_FROM_SUN).mul(side.mul(side)));

  return vec3(skyUniforms.glowColor).mul(skyUniforms.glow.mul(towardsHorizon).mul(reach).mul(float(1.0).sub(overcast().mul(GLOW_CLOUDED_LOSS))).mul(GLOW_STRENGTH));
}

/** The sun and the glare round it, looking in `direction`: far past white. */
function sunAt(direction: Node<"vec3">) {
  const towardsSun = dot(direction, vec3(skyUniforms.sunDirection));
  const disc = smoothstep(DISC_EDGE, DISC_FULL, towardsSun).mul(DISC_BRIGHTNESS);
  const closeGlare = pow(max(towardsSun, 0.0), GLARE_TIGHT.power).mul(GLARE_TIGHT.strength);
  const wideGlare = pow(max(towardsSun, 0.0), GLARE_WIDE.power).mul(GLARE_WIDE.strength);
  // Its colour, without its strength: the strength only says whether it is up
  const sunColor = vec3(skyUniforms.sunColor);
  const strongest = max(sunColor.x, max(sunColor.y, sunColor.z));
  // (squared: a sunset's sun is orange, not the pale yellow its light sums to)
  const hue = (() => {
    const share = sunColor.div(max(strongest, 1e-3));
    return share.mul(share);
  })();
  const isUp = smoothstep(0.0, 0.05, strongest).mul(smoothstep(HORIZON_SUN_FROM, HORIZON_SUN_FULL, direction.y));

  return hue.mul(disc.add(closeGlare).add(wideGlare)).mul(isUp);
}

/**
 * The sky in `direction`, hour and weather in it: the clear sky of the hour,
 * its glow and stars, the clouds lit as the hour lights them — and `sun`, the
 * sun's light apart, to be added once the haze is, so the haze does not hide it.
 */
export function skyOfTheHour(direction: Node<"vec3">) {
  const clouds = cloudsAt(direction, vec3(skyUniforms.cloudLight));
  const clear = gammaLift(
    clearSkyColor(direction, overcast(), vec3(skyUniforms.zenith), vec3(skyUniforms.horizon), skyUniforms.dim)
  );
  const stars = starsAt(direction).mul(float(1.0).sub(overcast())).mul(skyUniforms.stars);
  const cleared = clear.add(glowAt(direction)).add(stars);
  // The clouds are in front of the glow and the stars
  const sky = mix(cleared, clouds.color, clouds.cover);
  const sun = sunAt(direction).mul(float(1.0).sub(clouds.cover));

  return { sky, sun };
}
