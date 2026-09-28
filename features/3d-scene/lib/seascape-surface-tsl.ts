/**
 * Seascape — 4b. World-space surface
 *
 * The sea as real geometry: a flat grid lifted by the height of the waves.
 * Because it is geometry, it has depth — the ship's hull goes under the
 * surface — and it is seen through the scene's real camera.
 *
 * The waves are the wind-driven ones (`seascape-wind-waves.ts`), in metres;
 * the lighting is still the Shadertoy's, which works in its own "sea space",
 * so points are converted to that just before shading.
 *
 * - Vertex: the grid is lifted by every wave long enough for the grid to draw
 *   (a few cells per wavelength); shorter ones would only alias.
 * - Fragment: the normal comes from every wave, down to the ones a few pixels
 *   long, plus the short chop — so the detail the grid cannot hold still
 *   shapes the light.
 *
 * Performance: the normal needs the slope, and the slope three heights per
 * wave. The slope of a sum is the sum of the slopes, so the longest waves'
 * slope is computed per vertex and interpolated, the other waves per pixel —
 * see `VERTEX_OCTAVES` — and the short chop comes from a normal map, two
 * texture reads. Measured at 1080p, each against the Shadertoy surface in the
 * same run:
 *   6 octaves of waves, all per pixel        +55%
 *   6 octaves, longest two per vertex         -4%
 *   3 octaves of waves + normal map chop     -33%
 *   ... with 3 trains in octaves 1-2, SSS     -21%   <- current
 */
import {
  cameraPosition,
  Discard,
  dot,
  exp,
  float,
  Fn,
  fwidth,
  length,
  max,
  mix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  pow,
  positionWorld,
  screenSize,
  smoothstep,
  texture,
  time,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { Color, Vector4, type Node, type Texture, type Vector3 } from "three/webgpu";
import type { ContactFoam } from "./seascape-contact-foam";
import type { Wake } from "./seascape-wake";
import { valueNoise } from "./seascape-noise";
import {
  kelvinWakeFoam,
  kelvinWakeHeight,
  kelvinWakeSlope,
  type KelvinHistory,
} from "./seascape-kelvin-wake";
import type { FftSurfaceNodes } from "./seascape-fft-surface";
import { crestFoamColor, crestFoamDensity, foamGrain, hullFoamDensity } from "./seascape-foam-tsl";
import { shadeSea } from "./seascape-lighting";
import { WAVES_AMPLITUDE } from "./seascape-waves";
import {
  packWindSeaState,
  windSeaDetailSlope,
  windSeaElevation,
  windSeaSlope,
  windSeaState,
  waveFace,
  windSeaWhitecaps,
  whitecapLevels,
  type Wind,
  type WindSeaNodes,
} from "./seascape-wind-waves";

/**
 * Nearest distance, in metres, the slope is measured over. Up close the step
 * shrinks with the distance squared; below a centimetre, float precision in the
 * wave phases turns the differences into noise.
 */
const MIN_SLOPE_STEP = 0.01;

/**
 * The grid's filter size, in cells. Waves fade out of the geometry below 4
 * filter sizes and are gone below 2, so with 2 cells a wave needs 8 cells to
 * lift the grid fully and vanishes from it below 4; shorter waves stay in the
 * lighting only. With 1, a pointed crest drawn with 4 vertices came out
 * stepped and faceted.
 */
const GEOMETRY_FILTER_CELLS = 2;

/**
 * How opaque the foam against the hull gets: thicker than a whitecap's, as
 * the hull churns the water all the time.
 */
const MAX_HULL_FOAM = 0.8;
/** How opaque the foam on the ship's waves gets, and its thinnest against that, where the grain is lightest. */
const MAX_SHIP_WAVES_FOAM = 0.85;
const SHIP_WAVES_FOAM_THINNEST = 0.4;
/** The step the ship's own waves' slope is measured over, in world units. */
const SHIP_WAVES_SLOPE_STEP = 0.6;
/**
 * How far the big waves' slope pushes the wake's foam, in world units per unit
 * of slope: the trail bends with the waves it lies on.
 */
const WAKE_WAVE_PUSH = 25;
/** The wake's foam in the waves' troughs and on their crests, against its own. */
const WAKE_IN_TROUGHS = 0.55;
const WAKE_ON_CRESTS = 1.25;

// The churn behind the ship
/** Size of the churned water's tumbling features, in world units. */
const CHURN_SIZE = 2.5;
/** How fast it tumbles, in noise cells per second, besides flowing back with the sea. */
const CHURN_TUMBLE = 0.6;
/** Its height at the stern, in world units: the propellers' wash bulges the surface. */
const CHURN_HEIGHT = 0.35;

// Residual foam
/**
 * Off: its patches read as flat decals on the water. The buoys show the ship
 * moving instead (`seascape-buoys.ts`). Kept, to try again with a better look.
 */
const IS_RESIDUAL_FOAM_ENABLED = false;
/** Size of its patches across the waves' travel, in world units, and how much longer they are along it. */
const RESIDUAL_FOAM_SIZE = 14;
const RESIDUAL_FOAM_STRETCH = 3;
/** Noise values where a patch starts and is full: only the noise's highest parts, so they are sparse. */
const RESIDUAL_FOAM_START = 0.3;
const RESIDUAL_FOAM_FULL = 0.65;
/** How fast it drifts downwind, in m/s: a few per cent of the wind, as foam does. */
const RESIDUAL_FOAM_DRIFT = 0.3;
/** Hs, in world units, below which the sea leaves none, and at which it leaves its most. */
const RESIDUAL_FOAM_CALM_HS = 0.5;
const RESIDUAL_FOAM_ROUGH_HS = 4;
/** How opaque it gets against a whitecap: thin, old foam. */
const RESIDUAL_FOAM_STRENGTH = 0.55;

// The water thrown up behind the stern
/** Height of its mounds right behind the stern, in world units. */
const STERN_CHURN_HEIGHT = 1.8;
/** Size of the mounds, in world units: over a grid cell, so the geometry holds them. */
const STERN_CHURN_SIZE = 8;
/** Distance behind the stern, in world units, over which the mounds settle to a third. */
const STERN_CHURN_REACH = 40;
/** How far ahead of the stern the mounds start rising, and behind it they are full. */
const STERN_CHURN_START = 5;
/** How fast they tumble, in noise cells per second. */
const STERN_CHURN_TUMBLE = 0.4;
/** The step their slope is measured over, in world units. */
const STERN_CHURN_SLOPE_STEP = 1.0;

/** The wake's foam against a whitecap's: a little thicker, as the propellers churn it. */
const WAKE_FOAM_STRENGTH = 1.3;

/**
 * The share of Monahan's whitecap coverage that `foamAmount` 1 gives. The full
 * law covered the crests in white; a quarter of it, with the translucent foam,
 * reads right. The whole 0-1 range of the panel is below it, for fine control.
 */
const FOAM_AMOUNT_OF_MONAHAN = 0.25;

/** How much of a pixel's slope spread widens the sun's highlight — see the fragment shader. */
const GLINT_SPREAD_WEIGHT = 0.5;

/**
 * How much of the body's scattered light depends on facing the sun: the rest
 * reaches every face, as light enters the water from all around.
 */
const SCATTER_SUN_WRAP_SHARE = 0.6;
/**
 * How much a face must turn towards the viewer (the cosine) to show none, and
 * all, of the scattered light.
 */
const SCATTER_FACING_NONE = -0.05;
const SCATTER_FACING_FULL = 0.45;

// Subsurface scattering
/**
 * How tightly the glow follows the sun: the cosine between where the camera
 * looks and where the sun is, both flattened onto the sea, to this power.
 */
const SUBSURFACE_SUN_POWER = 4.0;
/** The glow is full on crests this far above the mean level, as a share of Hs. */
const SUBSURFACE_CREST_OF_HS = 0.5;
/** Smallest crest height the glow ramps over, in metres, so a calm sea never divides by 0. */
const MIN_SUBSURFACE_CREST = 0.05;

/**
 * How far the short chop pushes the foam's strands, in sea units per unit of
 * slope: a steep ripple moves them about a metre.
 */
const FOAM_DISTORTION = 0.25;

/**
 * The chop fades out of the sky's reflection as the view turns grazing, between
 * these heights of the view direction (its y, looking down). (Only of the
 * reflection: taken out of the glints too, it left the sea flat and smooth
 * seen from sea level.) Near the horizon the reflected ray
 * skims the sky's white horizon, so every ripple flipped the reflection between
 * white and blue — a mottle of white clouds, worse the flatter the camera. Real
 * water seen that flat reads smooth.
 */
const CHOP_GRAZING_GONE = 0.04;
const CHOP_GRAZING_FULL = 0.3;

// How much of the chop the sky's reflection sees is set per layer — see
// `inReflection` in seascape-wind-waves.ts.

export const SEASCAPE_SURFACE_DEFAULTS = {
  /**
   * Scales the Fresnel reflection of the sky. Checked in the app with the
   * camera a few metres up: at 0.8 the wave faces turned to the pale horizon
   * read as white patches; at 0.3 the sea went matte; 0.5 keeps both the sky
   * and the water's colour.
   */
  reflectivity: 0.5,
  /**
   * The water's own colour, where it reflects no sky: a deep ocean blue, chosen
   * by eye in the Inspector. The Shadertoy's was a grey-green #597981.
   */
  deepColor: "#003b6b",
  /**
   * The tint crests and sunlit faces pick up: an aqua green, chosen by eye in
   * the Inspector. The Shadertoy's was a pale yellow-green #e7f3cc.
   */
  lightColor: "#42e6b5",
  /**
   * How much whitecap foam, from 0 (none) to 1 (FOAM_AMOUNT_OF_MONAHAN of what
   * Monahan's law gives — see `whitecapLevels`).
   */
  foamAmount: 0.6,
  /** Foam colour: white with a hint of the water's blue. */
  foamColor: "#e6f0f4",
  /**
   * Light that shines through the thin tops of the waves when looking towards
   * the sun: a vivid turquoise, as seen through backlit crests.
   */
  subsurfaceColor: "#00d2e0",
  /** How strong that glow is; 0 turns it off. */
  subsurfaceStrength: 0.25,
  /**
   * Sunlight scattered back out of the water's body: the turquoise of real
   * water, brightest on faces turned to both the sun and the viewer.
   */
  scatterColor: "#0f8aa0",
  /**
   * How strong that is; 0 leaves the water its deep colour only. Compared in
   * the app from the default camera: 0.7 washed the deep blue out to a light
   * turquoise, 0.35 still did; 0.2 keeps the deep blue with a hint of the
   * chop's texture.
   */
  scatterStrength: 0.2,
  /**
   * How tight the sun's glints are. The Shadertoy's 60 is one broad patch;
   * against the scene's real sun, which the default camera faces, it merged
   * into white blobs. Real sun glitter is a path of separate sparkles.
   */
  shininess: 600,
} as const;

type SurfaceOptions = {
  /** World units per unit of the Shadertoy's sea space, which the lighting works in. */
  scale: number;
  /** World Y of the sea's mean level. */
  levelY: number;
  /** World units between the grid's vertices, to start with: see `uniforms.cellSize`. */
  cellSize: number;
  /** The wind the sea starts with. */
  wind: Wind;
  /** The crest foam's mask: 1 for foam, 0 for water, in the red channel. */
  foamTexture: Texture;
  /** Tangent-space normal map for the short chop, tiling. */
  detailNormalsTexture: Texture;
  /** Towards the scene's sun, so the water is lit as the ship is. */
  sunDirection: Vector3;
  /**
   * The FFT ocean's cascades, to draw the waves from (see
   * `seascape-fft-surface.ts`). Without them, the analytic waves and the chop
   * normal map are drawn instead.
   */
  fft?: FftSurfaceNodes;
  /** How close the hull is, for the foam around it (see `seascape-contact-foam.ts`). */
  contactFoam?: ContactFoam;
  /**
   * How far the ship has sailed, in world x and z. The ship stays at the
   * origin and the sea is drawn this far along, so it flows past the hull as
   * if the ship moved through it.
   */
  seaOffset: Node<"vec2">;
  /** The trail the ship leaves, for its foam (see `seascape-wake.ts`). */
  wake?: Wake;
  /**
   * Where along z the ship's own waves start — its bow — in the ship's frame
   * (see `seascape-kelvin-wake.ts`). Without it, the ship raises no waves.
   */
  bowZ?: number;
  /** The ship's track, for its waves: see `createKelvinHistory`. Needed with `bowZ`. */
  kelvinTrack?: KelvinHistory;
};

/**
 * Writes a sea state into its uniforms: the waves the wind raises, and how
 * many of them break (`foamAmount` scales that — see SEASCAPE_SURFACE_DEFAULTS).
 */
export function applyWindSeaState(
  uniforms: { windSea: ReturnType<typeof createWindSeaUniforms>; whitecapLevels: { value: Vector4 } },
  wind: Wind,
  foamAmount: number
) {
  const state = windSeaState(wind);
  const packed = packWindSeaState(state);
  uniforms.windSea.travel.value.fromArray(packed.travel);
  uniforms.windSea.amplitudes.value.fromArray(packed.amplitudes);
  uniforms.windSea.detail.value.fromArray(packed.detail);
  uniforms.whitecapLevels.value.fromArray(whitecapLevels(state, wind.speed, foamAmount * FOAM_AMOUNT_OF_MONAHAN));
}

function createWindSeaUniforms() {
  return {
    travel: uniform(new Vector4()),
    amplitudes: uniform(new Vector4()),
    detail: uniform(new Vector4()),
  };
}

export function createSeascapeSurfaceNodes({
  scale,
  levelY,
  cellSize,
  wind,
  foamTexture,
  detailNormalsTexture,
  sunDirection,
  fft,
  contactFoam,
  seaOffset,
  wake,
  bowZ,
  kelvinTrack,
}: SurfaceOptions) {
  // The ship raises waves only with its track known
  const shipWaves = bowZ !== undefined && kelvinTrack ? { bowZ, track: kelvinTrack } : null;
  /** A world point, where it is on the sea: the sea has flowed past the ship. */
  const onSea = (world: Node<"vec2">) => world.add(seaOffset);

  const detailNormals = texture(detailNormalsTexture);

  /**
   * Live knobs, driven by the Inspector's "Seascape" panel.
   *
   * Uniforms, so changing them does not rebuild the shader. Read only here, in
   * the stage entry points, never inside a Fn with a layout — see the rule at
   * the top of `seascape-waves.ts`.
   */
  const uniforms = {
    /** The sea the wind raises; written by `applyWindSeaState`. */
    windSea: createWindSeaUniforms(),
    /**
     * World units between the grid's vertices: which waves the grid can hold,
     * and which go to the pixels. Must follow the grid when it is rebuilt.
     */
    cellSize: uniform(cellSize),
    /** 1 fades waves too fine for the pixel; 0 turns that off to compare. */
    antiAliasing: uniform(1.0),
    /** How much sky edge-on water reflects. */
    reflectivity: uniform(SEASCAPE_SURFACE_DEFAULTS.reflectivity),
    /** The water's own colour, where it reflects no sky. */
    deepColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.deepColor)),
    /** The tint crests and sunlit faces pick up. */
    lightColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.lightColor)),
    /** Where crests break — see `whitecapLevels`; written by `applyWindSeaState`. */
    whitecapLevels: uniform(new Vector4()),
    foamColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.foamColor)),
    /** The foam mask. Set `.value` to another texture to swap it without a rebuild. */
    foamMap: texture(foamTexture),
    /** Towards the sun: the highlights, the diffuse light, the glow and the foam's shading. */
    sunDirection: uniform(sunDirection.clone().normalize()),
    /** The ship's speed through the water, in m/s: how big its own waves are. */
    shipSpeed: uniform(0),
    /** Light shining through the crests towards the camera. */
    subsurfaceColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.subsurfaceColor)),
    subsurfaceStrength: uniform(SEASCAPE_SURFACE_DEFAULTS.subsurfaceStrength),
    /** Sunlight scattered back out of the water's body. */
    scatterColor: uniform(new Color(SEASCAPE_SURFACE_DEFAULTS.scatterColor)),
    scatterStrength: uniform(SEASCAPE_SURFACE_DEFAULTS.scatterStrength),
    /** How tight the sun's glints are. */
    shininess: uniform(SEASCAPE_SURFACE_DEFAULTS.shininess),
  };
  applyWindSeaState(uniforms, wind, SEASCAPE_SURFACE_DEFAULTS.foamAmount);

  const sea: WindSeaNodes = { ...uniforms.windSea, cellSize: uniforms.cellSize };

  /**
   * Distance over which to measure the slope, in metres: grows with the square
   * of the distance from the camera, so far water is averaged and stays calm
   * (the GLSL EPSILON_NRM, converted to metres).
   */
  const slopeStepFor = (toPoint: Node<"vec3">) =>
    max(dot(toPoint, toPoint).mul(0.1 / scale).div(screenSize.x), MIN_SLOPE_STEP);

  // Where this grid vertex is in the world, before and after it is lifted
  const vertexWorld = modelWorldMatrix.mul(vec4(positionGeometry, 1.0)).xyz;
  /**
   * The water thrown up behind the stern: the propellers' wash bulges the
   * surface into tumbling mounds, strongest right behind the stern and
   * settling within a few tens of metres. Carried with the sea, so it flows
   * back as the ship sails on. In world units, at a world point.
   */
  const sternChurnAt = (world: Node<"vec2">) => {
    if (!wake || bowZ === undefined) return float(0.0);
    const behindStern = float(-bowZ).sub(world.y);
    const nearStern = exp(max(behindStern, 0.0).div(STERN_CHURN_REACH).negate()).mul(
      smoothstep(-STERN_CHURN_START, STERN_CHURN_START, behindStern)
    );
    const tumbling = valueNoise(onSea(world).div(STERN_CHURN_SIZE).add(vec2(time.mul(STERN_CHURN_TUMBLE), 0.0)));

    // Squared, so the mounds are peaked with flat water between them: thrown-up
    // water, not a gentle swell
    const mound = tumbling.mul(0.5).add(0.5);

    return wake.sample(world).mul(nearStern).mul(mound.mul(mound)).mul(STERN_CHURN_HEIGHT);
  };

  // The ship's own waves, which stay with it (in the ship's frame)
  const shipWavesAt = (world: Node<"vec2">) =>
    shipWaves ? kelvinWakeHeight(world, shipWaves.track, shipWaves.bowZ) : float(0.0);
  const vertexLift = (
    fft
      ? fft.gridHeight(onSea(vertexWorld.xz), uniforms.cellSize)
      : windSeaElevation(onSea(vertexWorld.xz), time, sea, uniforms.cellSize.mul(GEOMETRY_FILTER_CELLS))
  )
    .add(shipWavesAt(vertexWorld.xz))
    .add(sternChurnAt(vertexWorld.xz));

  /**
   * Vertex: lift the grid to the sea's height.
   *
   * Uses the world position rather than the local one, so the waves stay put
   * in the world while the grid follows the camera around.
   */
  const positionNode = Fn(() => positionGeometry.add(vec3(0.0, vertexLift, 0.0)))();

  /**
   * Slope and height of the longest waves, computed per vertex and handed to
   * the fragment shader, which receives them interpolated between the vertices.
   */
  const vertexWaves = varying(
    Fn(() => {
      // The FFT ocean's slopes all come per pixel
      if (fft) return vec3(0.0);

      const toVertex = vertexWorld.add(vec3(0.0, vertexLift, 0.0)).sub(cameraPosition);

      return windSeaSlope("vertex", onSea(vertexWorld.xz), slopeStepFor(toVertex), time, sea, uniforms.cellSize);
    })(),
    "vWindSeaVertexWaves"
  );

  /**
   * World space -> the Shadertoy's sea space, for the lighting and the foam:
   * scaled down, with the mean level where its maths expects (`WAVES_AMPLITUDE`).
   */
  const toSeaSpace = (world: Node<"vec3">) =>
    vec3(world.x.div(scale), world.y.sub(levelY).div(scale).add(WAVES_AMPLITUDE), world.z.div(scale));

  /**
   * Fragment: the normal from every wave the pixel can show, and the shading.
   */
  const fragmentNode = Fn(() => {
    const toPoint = positionWorld.sub(cameraPosition);

    // How much sea this pixel covers, in metres. Waves shorter than a few of
    // these are faded out, which is what keeps distant water from moiré.
    // (antiAliasing 0 reports a vanishing pixel, so nothing is ever faded.)
    // Evaluated here, as a variable, before any branch: derivatives like
    // fwidth are only valid in uniform control flow.
    const pixelSize = length(fwidth(positionWorld.xz)).mul(uniforms.antiAliasing).toVar();

    // Where this pixel is on the sea, which flows past the ship (`seaOffset`)
    const seaPosition = onSea(positionWorld.xz).toVar();

    // Total slope = the longest waves (from the vertices) + the other waves
    // (per pixel) + the short chop (the normal map)
    const pixelWaves = fft
      ? fft.pixelWaves(seaPosition)
      : windSeaSlope("pixel", seaPosition, slopeStepFor(toPoint), time, sea, pixelSize);
    const viewDirection = normalize(toPoint);
    const notGrazing = smoothstep(CHOP_GRAZING_GONE, CHOP_GRAZING_FULL, viewDirection.y.negate());
    const chop = windSeaDetailSlope(seaPosition, length(toPoint), time, sea, detailNormals);
    // The FFT ocean already holds the chop, down to centimetres
    const detailSlope = fft ? vec2(0.0) : chop.slope;
    // The ship's own waves' slope: finite differences, a little over half a metre
    const shipWavesSlope =
      shipWaves
        ? kelvinWakeSlope(positionWorld.xz, shipWaves.track, shipWaves.bowZ, SHIP_WAVES_SLOPE_STEP)
        : vec2(0.0);
    // The churned water behind the ship: propeller wash, a tumbling surface
    // strongest at the stern and calming along the trail with the wake itself.
    // Noise carried with the sea, so the churn flows back with the water
    const wakeHere = wake ? wake.sample(positionWorld.xz).toVar() : float(0.0);
    const churnAt = seaPosition.div(CHURN_SIZE).add(vec2(time.mul(CHURN_TUMBLE), 0.0));
    const churnStep = float(1.0 / CHURN_SIZE);
    const churnHere = valueNoise(churnAt);
    const churnSlope = vec2(
      valueNoise(churnAt.add(vec2(churnStep, 0.0))).sub(churnHere),
      valueNoise(churnAt.add(vec2(0.0, churnStep))).sub(churnHere)
    )
      .div(churnStep.mul(CHURN_SIZE))
      .mul(CHURN_HEIGHT)
      .mul(wakeHere);
    // The stern's mounds, as the grid is lifted by them: their slope for the light
    const sternHere = sternChurnAt(positionWorld.xz);
    const sternSlope = vec2(
      sternChurnAt(positionWorld.xz.add(vec2(STERN_CHURN_SLOPE_STEP, 0.0))).sub(sternHere),
      sternChurnAt(positionWorld.xz.add(vec2(0.0, STERN_CHURN_SLOPE_STEP))).sub(sternHere)
    ).div(STERN_CHURN_SLOPE_STEP);
    const slope = vertexWaves.xy
      .add(pixelWaves.xy)
      .add(detailSlope)
      .add(shipWavesSlope)
      .add(churnSlope)
      .add(sternSlope);
    const normal = normalize(vec3(slope.x.negate(), 1.0, slope.y.negate()));

    // Specular anti-aliasing (Toksvig): the slope's spread across this pixel
    // widens the highlight. Blinn-Phong's shininess s is a roughness of
    // α² = 2 / (s + 2); the spread adds to it. Without it, the chop's glints
    // came out as single white pixels scattered over the whole sea, a noise
    // that flickered as it moved — real glitter is finer than a pixel and
    // reads as a soft sheen.
    const slopeSpread = fwidth(slope.x).mul(fwidth(slope.x)).add(fwidth(slope.y).mul(fwidth(slope.y)));
    const glintRoughness = float(2.0).div(uniforms.shininess.add(2.0)).add(slopeSpread.mul(GLINT_SPREAD_WEIGHT));
    const glintShininess = float(2.0).div(glintRoughness).sub(2.0).max(1.0);
    // The glints see all the chop, at any angle; the sky's reflection mostly
    // the longer chop, and none at grazing angles (see `inReflection` and
    // CHOP_GRAZING_GONE)
    const reflectionSlope = fft ? slope : slope.sub(detailSlope).add(chop.reflectionSlope.mul(notGrazing));
    const reflectionNormal = normalize(vec3(reflectionSlope.x.negate(), 1.0, reflectionSlope.y.negate()));

    // The sea's height here, per pixel, from the same two shares. Not the
    // triangle's own height, which is interpolated straight between vertices:
    // anything that follows the height — the crest tint, the glow — drew the
    // triangles' edges as straight lines
    // The sea's own height: what the crest glow and tint follow. The ship's
    // waves are left out of them — added, they lit every band of the V turquoise
    const height = vertexWaves.z.add(pixelWaves.z);

    const sun = vec3(uniforms.sunDirection);

    // Subsurface scattering: looking towards the sun, light comes through the
    // thin tops of the waves and lights them turquoise from inside. Strongest
    // straight towards the sun and on the highest crests. (The view's own
    // flat part, not normalised: it shrinks to nothing looking straight down,
    // where its direction flips — normalised, that drew a wedge under the camera)
    const towardsSun = max(dot(viewDirection.xz, normalize(sun.xz)), 0.0);
    const crestHeight = max(sea.travel.w.mul(SUBSURFACE_CREST_OF_HS), MIN_SUBSURFACE_CREST);
    const onCrest = smoothstep(0.0, crestHeight, height);
    const crestGlow = vec3(uniforms.subsurfaceColor)
      .mul(pow(towardsSun, SUBSURFACE_SUN_POWER))
      .mul(onCrest)
      .mul(uniforms.subsurfaceStrength);

    // Light scattered back out of the water's body. It leaves through the
    // surface towards the viewer, so faces turned to the viewer show more of
    // it — that is what makes the chop visible as texture from any height,
    // without the sky's reflection — and it is sunlight, so faces turned to the
    // sun (wrapped: light also reaches in from the side) are brighter. What the
    // surface reflects does not come out: scaled by 1 - Fresnel.
    // (Eased rather than linear: seen from sea level hardly any face turns
    // towards the camera, and a linear term left the near water flat.)
    const towardsViewer = smoothstep(SCATTER_FACING_NONE, SCATTER_FACING_FULL, dot(normal, viewDirection.negate()));
    const sunReach = max(dot(normal, sun), 0.0).mul(SCATTER_SUN_WRAP_SHARE).add(1.0 - SCATTER_SUN_WRAP_SHARE);
    const scatter = vec3(uniforms.scatterColor).mul(towardsViewer.mul(sunReach)).mul(uniforms.scatterStrength);

    const subsurface = crestGlow.add(scatter);

    // The lighting's crest tint is the Shadertoy's, made for waves about
    // ±WAVES_AMPLITUDE high; so it is given the height as a share of Hs, the
    // same at any wind. Given metres, a storm's deep troughs took the green
    // out of the water and left it purple
    const tintHeight = height.div(max(sea.travel.w, MIN_SUBSURFACE_CREST)).clamp(-1.0, 1.0).mul(WAVES_AMPLITUDE * scale);
    const point = toSeaSpace(vec3(seaPosition.x, tintHeight.add(levelY), seaPosition.y));
    const water = shadeSea(
      point,
      normal,
      viewDirection,
      toPoint.div(scale),
      uniforms.reflectivity,
      uniforms.deepColor,
      uniforms.lightColor,
      sun,
      glintShininess,
      subsurface,
      1.0,
      reflectionNormal
    );

    // White water on the highest crests, laid over the water's colour. The
    // haze is applied afterwards by the scene's fog, so far foam fades too
    const grain = foamGrain({
      point,
      travel: sea.travel.xy,
      seaTime: time,
      foamMap: uniforms.foamMap,
      // The FFT ocean has no separate chop: its whole slope pushes the grain
      distortion: (fft ? slope : detailSlope).mul(FOAM_DISTORTION),
    });
    // Where the foam lies follows the big waves only: their height and which
    // face of them this is. The chop's height and slope flip from ripple to
    // ripple, and cut holes and hatching into the foam's edge
    const bigWaves = fft ? fft.largeWaves(seaPosition) : vertexWaves;
    const whitecaps = windSeaWhitecaps(
      seaPosition,
      time,
      sea.travel,
      bigWaves.z,
      bigWaves.xy,
      uniforms.whitecapLevels,
      grain.x.add(grain.y).mul(0.5)
    );
    const crestFoam = crestFoamDensity(whitecaps, grain, waveFace(bigWaves.xy, sea.travel.xy));

    // Foam against the hull: a continuous veil fading out with the distance
    const hullFoam = contactFoam
      ? hullFoamDensity(contactFoam.sample(positionWorld.xz), grain).mul(MAX_HULL_FOAM)
      : float(0.0);
    // The wake: foam left behind the ship, aging into lace as it falls back
    // Carried by the waves: pushed along their slopes, so the trail bends with
    // them, and thicker on their crests than in their troughs
    const wakeOnWaves = wake
      ? wake.sample(positionWorld.xz.add(bigWaves.xy.mul(WAKE_WAVE_PUSH))).mul(
          mix(
            float(WAKE_IN_TROUGHS),
            float(WAKE_ON_CRESTS),
            smoothstep(sea.travel.w.mul(-0.5), sea.travel.w.mul(0.5), bigWaves.z)
          )
        )
      : float(0.0);
    const wakeFoam = wake
      ? crestFoamDensity(wakeOnWaves, grain, float(1.0)).mul(WAKE_FOAM_STRENGTH)
      : float(0.0);
    // Foam on the crests of the ship's own waves: the white V
    const shipWavesFoam =
      !shipWaves
        ? float(0.0)
        : // Fresh foam: the amount itself, shaded by the grain into a veil
          kelvinWakeFoam(positionWorld.xz, shipWaves.track, shipWaves.bowZ)
            .mul(mix(float(SHIP_WAVES_FOAM_THINNEST), float(1.0), grain.x))
            .mul(MAX_SHIP_WAVES_FOAM);
    // Residual foam: pale patches and streaks left by crests that broke a while
    // ago. They lie still in the water, drifting only slowly downwind — so
    // under way they pass the ship at its own speed, whichever way the waves
    // run, and show it moving. More of them the rougher the sea
    const residualAt = seaPosition.sub(sea.travel.xy.mul(time.mul(RESIDUAL_FOAM_DRIFT)));
    const residualAlong = dot(residualAt, sea.travel.xy).div(RESIDUAL_FOAM_STRETCH);
    const residualAcross = dot(residualAt, vec2(sea.travel.y.negate(), sea.travel.x));
    const residualCell = vec2(residualAlong, residualAcross).div(RESIDUAL_FOAM_SIZE);
    const residualNoise = valueNoise(residualCell)
      .mul(2.0)
      .add(valueNoise(residualCell.mul(2.3).add(vec2(7.1, 3.3))))
      .div(3.0);
    const residualCoverage = smoothstep(RESIDUAL_FOAM_START, RESIDUAL_FOAM_FULL, residualNoise).mul(
      smoothstep(RESIDUAL_FOAM_CALM_HS, RESIDUAL_FOAM_ROUGH_HS, sea.travel.w)
    );
    const residualFoam = crestFoamDensity(residualCoverage, grain, float(1.0)).mul(RESIDUAL_FOAM_STRENGTH);

    const foam = max(
      max(crestFoam, hullFoam),
      max(wakeFoam, IS_RESIDUAL_FOAM_ENABLED ? max(shipWavesFoam, residualFoam) : shipWavesFoam)
    );
    const foamColor = crestFoamColor(vec3(uniforms.foamColor), normal, sun);

    // No sea inside the hull: seen over the bulwarks or through an open deck,
    // the water there filled the ship. Last, after every derivative and read
    if (contactFoam) Discard(contactFoam.isInsideHull(positionWorld.xz));

    return vec4(mix(water.rgb, foamColor, foam), 1.0);
  })();

  return { positionNode, fragmentNode, uniforms };
}
