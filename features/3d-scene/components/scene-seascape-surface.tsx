"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  DoubleSide,
  MeshBasicNodeMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  TextureLoader,
  type Mesh,
  type Texture,
} from "three/webgpu";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import {
  IS_FFT_OCEAN_ENABLED,
  SEASCAPE_CHOP_NORMALS_URL,
  SEASCAPE_DEFAULT_FOAM_TEXTURE,
  SEASCAPE_DETAIL_NORMALS_ANISOTROPY,
  SEASCAPE_FOAM_ANISOTROPY,
  SEASCAPE_FOAM_TEXTURES,
  SEASCAPE_SHIP_HULL,
  SEASCAPE_SURFACE_GRID_SEGMENT_OPTIONS,
  SEASCAPE_SURFACE_GRID_SIZE,
  SEASCAPE_SURFACE_LEVEL_Y,
  SEASCAPE_SURFACE_SCALE,
  SEASCAPE_WIND,
  SEASCAPE_WIND_LIMITS,
  type SeascapeFoamTextureName,
} from "../lib/seascape-config";
import { float } from "three/tsl";
import { createContactFoam } from "../lib/seascape-contact-foam";
import { useShipVoyage } from "./ship-voyage-context";
import { liveSceneOverrides, sceneSeaState } from "../lib/live-scene-overrides";
import { createWake } from "../lib/seascape-wake";
import { createFoamMemory } from "../lib/seascape-foam-memory";
import { DEFAULT_WAVES_FROM, waveDirections, WAVES_FROM_OPTIONS, type WavesFrom } from "../lib/seascape-wave-direction";
import { createSeaFrame, headOnTurn } from "../lib/seascape-sea-frame";
import { apparentWind, weatherState } from "../lib/seascape-weather";
import { getPerformanceProfile } from "../lib/performance-profile";
import { createKelvinHistory } from "../lib/seascape-kelvin-wake";
import { createBuoys } from "../lib/seascape-buoys";
import { bowWave } from "../lib/seascape-bow-wave";
import { createBowSpray } from "../lib/seascape-bow-spray";
import { createBubbles } from "../lib/seascape-bubbles";
import { createPrecipitation } from "../lib/seascape-precipitation";
import { shipMotion as shipMotionState } from "../lib/seascape-ship-motion";
import { underwater } from "../lib/seascape-underwater";
import { createShipMotionSolver } from "../lib/seascape-ship-motion";
import { createWaveProbes } from "../lib/seascape-wave-probes";
import { createFftOcean } from "../lib/seascape-fft-ocean";
import { createFftSurfaceNodes } from "../lib/seascape-fft-surface";
import { fullyDevelopedFetch } from "../lib/seascape-wind-waves";
import {
  applyWindSeaState,
  createSeascapeSurfaceNodes,
  SEASCAPE_SURFACE_DEFAULTS,
} from "../lib/seascape-surface-tsl";
import { asSceneRenderer, getSceneInspector, isWebGPUBackend } from "../lib/webgpu-renderer";

// The bow's spray: from this speed (m/s) it begins and at the second it is full; in a rough
// sea (significant wave height, m) it is full, and in a calm one it keeps this share.
const SPRAY_FROM_SPEED = 4;
const SPRAY_FULL_SPEED = 11;
const SPRAY_FROM_WAVES = 0.8;
const SPRAY_FULL_WAVES = 3.5;
const SPRAY_CALM_SHARE = 0.3;

const smoothStep = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The sea is the first of the blended things drawn: what is faded above the water is over it. */
const SEA_RENDER_ORDER = -10;

/** World units between adjacent grid vertices, for a grid of `segments` per side. */
function cellSizeFor(segments: number): number {
  return (SEASCAPE_SURFACE_GRID_SIZE / segments) * GRID_CENTRE_DENSITY;
}

/**
 * The grid is dense under the camera and sparse towards its edge: a vertex's
 * position along each axis, t in [-1, 1] across the grid, is moved to
 * t · (k + (1 - k)·t²), with k GRID_CENTRE_DENSITY. Its cells are k times the
 * even spacing at the centre (5 units over 3200 with 320 segments) and
 * k + 3(1 - k) = 2 times it at the edge (20), out in the haze. As many cells
 * as an even 1600 grid, twice as far: 205k triangles, not the 819k an even
 * grid that size needed at 5 units.
 */
const GRID_CENTRE_DENSITY = 0.5;
/** How much larger a cell is at t than at the centre, per t²: 3(1 - k)/k. */
const GRID_CELL_GROWTH = (3 * (1 - GRID_CENTRE_DENSITY)) / GRID_CENTRE_DENSITY;

function warpAcrossGrid(position: number): number {
  const half = SEASCAPE_SURFACE_GRID_SIZE / 2;
  const t = position / half;

  return half * t * (GRID_CENTRE_DENSITY + (1 - GRID_CENTRE_DENSITY) * t * t);
}

/** Rounds to the nearest vertex, so moving the grid never shifts where vertices land. */
function snapToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}

/** The flat grid the sea is drawn on, lying in the xz plane. */
function createSeaGeometry(segments: number): PlaneGeometry {
  const geometry = new PlaneGeometry(SEASCAPE_SURFACE_GRID_SIZE, SEASCAPE_SURFACE_GRID_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  // Dense at the centre, sparse at the edge (see GRID_CENTRE_DENSITY); the uv
  // keeps the even spacing, for the shader to know each cell's size
  const positions = geometry.getAttribute("position");
  for (let vertex = 0; vertex < positions.count; vertex++) {
    positions.setX(vertex, warpAcrossGrid(positions.getX(vertex)));
    positions.setZ(vertex, warpAcrossGrid(positions.getZ(vertex)));
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Loads a foam mask. It is data, not a picture: no colour-space conversion,
 * and tiled across the sea. The loader returns the texture at once and fills
 * it in when the image arrives; until then the foam reads as none.
 */
function loadFoamTexture(name: SeascapeFoamTextureName): Texture {
  const foamTexture = new TextureLoader().load(SEASCAPE_FOAM_TEXTURES[name]);
  foamTexture.colorSpace = NoColorSpace;
  foamTexture.wrapS = RepeatWrapping;
  foamTexture.wrapT = RepeatWrapping;
  foamTexture.anisotropy = SEASCAPE_FOAM_ANISOTROPY;

  return foamTexture;
}

/** The short chop's normal map: data, not a picture, and tiled. */
function loadDetailNormalsTexture(): Texture {
  const normals = new TextureLoader().load(SEASCAPE_CHOP_NORMALS_URL);
  normals.colorSpace = NoColorSpace;
  normals.wrapS = RepeatWrapping;
  normals.wrapT = RepeatWrapping;
  normals.anisotropy = SEASCAPE_DETAIL_NORMALS_ANISOTROPY;

  return normals;
}

/** Foam textures loaded so far, so switching back and forth loads each once. */
const loadedFoamTextures = new Map<SeascapeFoamTextureName, Texture>();

function getFoamTexture(name: SeascapeFoamTextureName): Texture {
  const loaded = loadedFoamTextures.get(name) ?? loadFoamTexture(name);
  loadedFoamTextures.set(name, loaded);

  return loaded;
}

/**
 * The area around the ship the hull foam's footprint covers, in world units:
 * the ship (100 long) with room around it, for its bow and stern waves.
 */
const CONTACT_FOAM_AREA = 260;
/** Nodes of the ship's model that make its hull, below the waterline and above. */
const SHIP_HULL_NODE_NAMES = ["Base"] as const;

/** How much this device draws: see `performance-profile.ts`. */
const PROFILE = getPerformanceProfile();

/**
 * Texels along each side: about 25 cm each on desktop, 50 on a phone. The
 * distance field is smooth, so the foam barely differs from 2048², at a
 * quarter of the cost or less.
 */
const CONTACT_FOAM_RESOLUTION = PROFILE.contactFoamResolution;
/**
 * How far the foam reaches from the hull, in world units, to start with. A few
 * tens of centimetres are what churns right against a hull, but seen from the
 * default camera, 200 units from a ship this size, less than a unit does not
 * show; the Inspector goes down to 0.1.
 */
const CONTACT_FOAM_DISTANCE = 1.0;
const MAX_CONTACT_FOAM_DISTANCE = 10;
/**
 * How often the footprint is redrawn, in frames: every other on desktop, every
 * fourth on a phone — the ship and its waterline move slowly, and the
 * footprint redraws the whole ship. (Every 30, the foam trailed the ship's
 * motion by up to half a second.)
 */
const CONTACT_FOAM_REDRAW_FRAMES = PROFILE.contactFoamRedrawFrames;
/**
 * Seconds after the ship stops that its wake still has something to draw:
 * a few of its lifetimes. Past that, its passes are skipped.
 */
const WAKE_SETTLE_SECONDS = 150;
/**
 * The same for the ship's own waves: five of their 15 s lifetimes
 * (`seascape-kelvin-wake.ts`), by which under 1% of them is left.
 */
const SHIP_WAVES_SETTLE_SECONDS = 75;
/** Speed through the water, in m/s, below which the ship counts as still: no propeller wash. */
const STILL_SPEED = 0.3;

/**
 * How far, in world units, the view blends from air to water as the camera
 * crosses the surface, so it never flickers from one to the other.
 */
const WATERLINE_BLEND = 0.4;

/** The filter the bubbles' surface is read with, in world units: fine, a metre. */
const BUBBLE_SURFACE_FILTER = 1;

/** The highest crest the sea can raise, as a multiple of Hs: every wave train's crest at once. */
const HIGHEST_CREST_OF_HS = 1.7;

/**
 * The ship's speed through the water when under way, in knots. It stays at the
 * origin and the sea flows past it (see `seaFrame`). It starts still: the
 * button beside the zoom controls sets it under way.
 */
const SHIP_SPEED_KNOTS = 18;
const MAX_SHIP_SPEED_KNOTS = 30;
/**
 * How long the ship takes to gather speed or slow down, in seconds (the time
 * constant): a laden cargo ship does not start or stop at once.
 */
const SPEED_CHANGE_TIME = 6;
/** Metres per second in a knot. */
const METRES_PER_SECOND_PER_KNOT = 0.514444;

/** The wind, with the fetch it has over open ocean: the speed alone sets the sea. */
function windAt(speed: number, fromDegrees: number) {
  return { speed, fromDegrees, fetch: fullyDevelopedFetch(speed) };
}

/** The wind the sea starts with. */
const INITIAL_WIND = windAt(SEASCAPE_WIND.speed, SEASCAPE_WIND.fromDegrees);

/**
 * How far the data's wind, averaged, must move from the one the sea was
 * raised by before it raises a new one, in m/s. A new wind rebuilds the
 * spectrum on the CPU (a frame's hitch) and changes the waves' heights at
 * once: not for the gusts the data drifts by.
 */
const LIVE_WIND_STEP_MS = 1;
/**
 * The time constant the data's wind is averaged over for the sea, in seconds:
 * a sea answers the wind of the last minutes, not of the last second.
 */
const LIVE_WIND_AVERAGING_S = 60;
/**
 * How slowly the sea turns to follow the side the data's wind comes from, in
 * seconds (the time constant): the wind drifts by a few degrees, and the
 * whole sea turning with it at once read as the ship yawing.
 */
const WIND_SIDE_SMOOTHING_S = 20;
/** The same for the side the user sets: quick, as it follows a slider, and still not a jump. */
const USER_WIND_SIDE_SMOOTHING_S = 1.5;
const RADIANS_PER_DEGREE = Math.PI / 180;

/** Identifies a wind, to notice when it changes. */
function windKey(wind: { speed: number; fromDegrees: number; fetch: number }) {
  return `${wind.speed}|${wind.fromDegrees}|${wind.fetch}`;
}

/** Builds the grid, its material and the shader's tuning uniforms, once. */
function createSeaSurface(canUseCompute: boolean) {
  const geometry = createSeaGeometry(PROFILE.gridSegments);
  // The FFT ocean needs compute shaders: WebGPU only. On three's WebGL
  // fallback the analytic waves are drawn instead
  const ocean = IS_FFT_OCEAN_ENABLED && canUseCompute ? createFftOcean(INITIAL_WIND) : null;
  const fft = ocean ? createFftSurfaceNodes(ocean.cascades) : undefined;
  // The ship rides the FFT ocean; on the analytic fallback it rests still
  const shipMotion = createShipMotionSolver(SEASCAPE_SHIP_HULL);
  const seaFrame = createSeaFrame();

  const contactFoam = createContactFoam({
    areaSize: CONTACT_FOAM_AREA,
    resolution: CONTACT_FOAM_RESOLUTION,
    // The model's hull node: the only part that meets the water
    hullNodeNames: SHIP_HULL_NODE_NAMES,
    // The widest the Inspector lets the foam reach (the wake stirs within less)
    maxDistance: MAX_CONTACT_FOAM_DISTANCE,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
    distance: CONTACT_FOAM_DISTANCE,
    // The FFT ocean's own height, so the hull is cut at the real waterline
    waterHeight: fft ? (position) => fft.pixelWaves(seaFrame.toSea(position)).z : undefined,
  });
  const wake = createWake(contactFoam);
  // The foam breaking crests leave in the water: FFT only, as it reads their waves
  const foamMemory = fft ? createFoamMemory() : undefined;
  const kelvinTrack = createKelvinHistory();
  // Buoys moored around the ship, riding the waves: probed like the ship
  const buoys = createBuoys(SEASCAPE_SURFACE_LEVEL_Y);
  // Kept under the real surface: the FFT ocean's height, where the sea has flowed to
  const bubbles = createBubbles(
    SEASCAPE_SURFACE_LEVEL_Y,
    fft ? (position) => fft.gridHeight(seaFrame.toSea(position), float(BUBBLE_SURFACE_FILTER)) : undefined
  );
  // Water thrown off the stem at speed in a rough sea
  const bowSpray = createBowSpray(
    SEASCAPE_SURFACE_LEVEL_Y,
    SEASCAPE_SHIP_HULL.halfLength,
    fft ? (position) => fft.gridHeight(seaFrame.toSea(position), float(BUBBLE_SURFACE_FILTER)) : undefined
  );
  // Rain and snow round the camera, never below the real surface
  const precipitation = createPrecipitation(
    SEASCAPE_SURFACE_LEVEL_Y,
    fft ? (position) => fft.gridHeight(seaFrame.toSea(position), float(BUBBLE_SURFACE_FILTER)) : undefined
  );

  // The sea's height where things ride it — under the ship, at the buoys,
  // right over the camera (whether it is under water) — all in one set of
  // probes: one dispatch and one read back a frame, not three
  const probeLayout = {
    ship: shipMotion.points.length,
    buoys: buoys.probePoints(0).length,
  };
  const probePointsFor = (sailed: number, cameraX: number, cameraZ: number) => [
    ...shipMotion.points,
    ...buoys.probePoints(sailed),
    { x: cameraX, z: cameraZ },
  ];
  const probes = ocean ? createWaveProbes(ocean.cascades, probePointsFor(0, 0, 0), seaFrame.toSea) : null;

  const nodes = createSeascapeSurfaceNodes({
    scale: SEASCAPE_SURFACE_SCALE,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
    cellSize: cellSizeFor(PROFILE.gridSegments),
    cellGrowth: GRID_CELL_GROWTH,
    wind: INITIAL_WIND,
    foamTexture: getFoamTexture(SEASCAPE_DEFAULT_FOAM_TEXTURE),
    detailNormalsTexture: loadDetailNormalsTexture(),
    fft,
    contactFoam,
    seaFrame,
    wake,
    foamMemory,
    bowZ: SEASCAPE_SHIP_HULL.halfLength,
    kelvinTrack,
  });
  const material = new MeshBasicNodeMaterial();
  material.positionNode = nodes.positionNode;
  // fragmentNode rather than colorNode: the shader lights itself, and the
  // material's own logic would otherwise apply the scene's environment map.
  material.fragmentNode = nodes.fragmentNode;
  // Both faces: from under the water the camera sees the surface's underside
  material.side = DoubleSide;
  // Blended over what is under the water (the hull's underwater part), by the water's thickness over it
  material.transparent = true;

  return {
    geometry,
    segments: PROFILE.gridSegments,
    material,
    uniforms: nodes.uniforms,
    ocean,
    fft,
    contactFoam,
    seaFrame,
    wake,
    foamMemory,
    kelvinTrack,
    buoys,
    bubbles,
    bowSpray,
    precipitation,
    probes,
    probeLayout,
    probePointsFor,
    shipMotion,
    /** Frames drawn, for what is updated only every few. */
    frame: 0,
    /** Seconds the ship has been still, for when its wake has settled. */
    stillSeconds: WAKE_SETTLE_SECONDS,
    /** How far the ship has sailed, in world units: for the buoys, moored along its track. */
    sailed: 0,
    /** The ship's speed through the water right now, in m/s: eased towards its target. */
    speed: 0,
    /** Frames since the hull foam's footprint was last drawn. */
    framesSinceContactFoam: Infinity,
    /** The distance it was drawn for. */
    contactFoamDistance: NaN,
    /** The wind the FFT spectrum was last built for, to rebuild it only on a change. */
    oceanWindKey: windKey(INITIAL_WIND),
    /**
     * The side the waves come from, radians off the bow, starboard positive:
     * following the data's wind, slowly. Null until it gives one.
     */
    windSide: null as number | null,
    /** The data's wind speed averaged (LIVE_WIND_AVERAGING_S), and the one the sea was raised by, m/s: null until it gives one. */
    liveWindAverage: null as number | null,
    liveWindRaised: null as number | null,
  };
}

/**
 * Live values behind the Inspector's Seascape panel, for debugging the sea.
 *
 * Applied to the shader every frame while the Inspector is on. Nothing here
 * persists across a reload — if a value is worth keeping, move it into the
 * shader code.
 */
const SEASCAPE_TUNING = {
  /** Wind speed at 10 m, m/s: sets how high and how long the waves are. */
  windSpeed: SEASCAPE_WIND.speed as number,
  /** Compass bearing the wind blows from (0 = +Z, 90 = +X). */
  windFromDegrees: SEASCAPE_WIND.fromDegrees as number,
  /** Fade waves too fine for the pixel. Off to compare against no fix. */
  antiAliasing: true,
  /** How much sky edge-on water reflects. */
  reflectivity: SEASCAPE_SURFACE_DEFAULTS.reflectivity,
  /** The water's own colour. */
  deepColor: SEASCAPE_SURFACE_DEFAULTS.deepColor as string,
  /** The tint crests and sunlit faces pick up. */
  lightColor: SEASCAPE_SURFACE_DEFAULTS.lightColor as string,
  /** Whitecap foam against what the wind makes: 1 is Monahan's law. */
  foamAmount: SEASCAPE_SURFACE_DEFAULTS.foamAmount as number,
  /** Where the waves come from round the ship: see `seascape-wave-direction.ts`. */
  wavesFrom: DEFAULT_WAVES_FROM as WavesFrom,
  /** The foam breaking crests leave in the water, how opaque: 0 for none (see `seascape-foam-memory.ts`). */
  leftFoam: 0.85,
  /** The residual foam's patches, how opaque: 0 for none, as by default. */
  residualFoam: 0,
  /** The sun's light through the wave faces turned to it: 0 for none (the old look), up for more. */
  bodyLight: 0.55,
  waterAbsorption: 0.2,
  refraction: 0.05,
  foamColor: SEASCAPE_SURFACE_DEFAULTS.foamColor as string,
  /** Which foam mask texture; see `SEASCAPE_FOAM_TEXTURES`. */
  foamTexture: SEASCAPE_DEFAULT_FOAM_TEXTURE as SeascapeFoamTextureName,
  /** Light shining through the crests when looking towards the sun. */
  subsurfaceColor: SEASCAPE_SURFACE_DEFAULTS.subsurfaceColor as string,
  subsurfaceStrength: SEASCAPE_SURFACE_DEFAULTS.subsurfaceStrength as number,
  /** Sunlight scattered back out of the water's body: its turquoise. */
  scatterColor: SEASCAPE_SURFACE_DEFAULTS.scatterColor as string,
  scatterStrength: SEASCAPE_SURFACE_DEFAULTS.scatterStrength as number,
  /** How tight the sun's glints are: higher is smaller, brighter sparkles. */
  shininess: SEASCAPE_SURFACE_DEFAULTS.shininess as number,
  /**
   * Grid segments per side. More holds shorter waves in the geometry and
   * smooths the crests' outline, at the cost of vertices — see
   * `performance-profile.ts` for what each device starts with.
   */
  gridSegments: PROFILE.gridSegments as number,
  /** The ship's speed through the water under way, in knots: the sea flows past at it. */
  shipSpeedKnots: SHIP_SPEED_KNOTS as number,
  /** How far the foam around the hull reaches, in world units. */
  contactFoamDistance: CONTACT_FOAM_DISTANCE as number,
  /** Draw the sea's triangles as lines, to see what the grid is doing. */
  wireframe: false,
};


/**
 * The "Seascape" sea as real geometry: a grid displaced by the shader's wave
 * function, so the ship's hull can go under the surface.
 *
 * Experimental counterpart of `SceneSeascape`; switch between them with
 * `IS_SEASCAPE_SURFACE_ENABLED`.
 */
export function SceneSeascapeSurface() {
  const gl = useThree((state) => state.gl);
  const meshRef = useRef<Mesh>(null);

  // Held in a ref, not a memo: the uniforms are written every frame, and the
  // React Compiler rightly refuses mutating a memoised value. A lazily filled
  // ref is the sanctioned escape hatch.
  // Under way or still, from the button beside the zoom controls; read every frame
  const { isTraveling } = useShipVoyage();
  const isTravelingRef = useRef(isTraveling);
  useEffect(() => {
    isTravelingRef.current = isTraveling;
  }, [isTraveling]);

  const seaRef = useRef<ReturnType<typeof createSeaSurface> | null>(null);
  seaRef.current ??= createSeaSurface(isWebGPUBackend(gl));
  const { geometry, material } = seaRef.current;

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Seascape");
    // Speed and wind follow the live data while it gives them (see useFrame): shown as they are
    panel.add(SEASCAPE_TUNING, "windSpeed", 0, SEASCAPE_WIND_LIMITS.maxSpeed, 0.1).listen();
    panel.add(SEASCAPE_TUNING, "windFromDegrees", 0, 360, 1);
    panel.add(SEASCAPE_TUNING, "antiAliasing");
    panel.add(SEASCAPE_TUNING, "reflectivity", 0, 1, 0.01);
    panel.addColor(SEASCAPE_TUNING, "deepColor");
    panel.addColor(SEASCAPE_TUNING, "lightColor");
    panel.add(SEASCAPE_TUNING, "foamAmount", 0, 1, 0.01);
    // For the sense of motion: where the waves come from, and the foam still in the water
    panel.add(SEASCAPE_TUNING, "wavesFrom", [...WAVES_FROM_OPTIONS]);
    panel.add(SEASCAPE_TUNING, "leftFoam", 0, 1, 0.01);
    panel.add(SEASCAPE_TUNING, "residualFoam", 0, 1, 0.01);
    panel.add(SEASCAPE_TUNING, "bodyLight", 0, 3, 0.05);
    panel.add(SEASCAPE_TUNING, "waterAbsorption", 0, 2, 0.01);
    panel.add(SEASCAPE_TUNING, "refraction", 0, 0.3, 0.005);
    panel.addColor(SEASCAPE_TUNING, "foamColor");
    panel.add(
      SEASCAPE_TUNING,
      "foamTexture",
      Object.keys(SEASCAPE_FOAM_TEXTURES) as SeascapeFoamTextureName[]
    );
    panel.addColor(SEASCAPE_TUNING, "subsurfaceColor");
    panel.add(SEASCAPE_TUNING, "subsurfaceStrength", 0, 2, 0.01);
    panel.addColor(SEASCAPE_TUNING, "scatterColor");
    panel.add(SEASCAPE_TUNING, "scatterStrength", 0, 2, 0.01);
    panel.add(SEASCAPE_TUNING, "shininess", 10, 2000, 1);
    panel.add(SEASCAPE_TUNING, "gridSegments", [...SEASCAPE_SURFACE_GRID_SEGMENT_OPTIONS]);
    panel.add(SEASCAPE_TUNING, "shipSpeedKnots", 0, MAX_SHIP_SPEED_KNOTS, 0.5).listen();
    panel.add(SEASCAPE_TUNING, "contactFoamDistance", 0.1, MAX_CONTACT_FOAM_DISTANCE, 0.1);
    panel.add(SEASCAPE_TUNING, "wireframe");
  }, [gl]);

  useFrame(({ camera, clock, scene }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const sea = seaRef.current;
    if (!sea) return;

    // Keep the grid under the camera. The waves are computed in world space,
    // so they stay put while the grid moves beneath them.
    const cellSize = cellSizeFor(sea.segments);
    mesh.position.x = snapToCell(camera.position.x, cellSize);
    mesh.position.z = snapToCell(camera.position.z, cellSize);

    // The FFT ocean's waves, brought to this moment: a few compute passes,
    // every frame or, on a phone, every other
    sea.frame++;
    if (sea.frame % PROFILE.oceanUpdateFrames === 0) sea.ocean?.update(asSceneRenderer(gl), clock.elapsedTime);

    // The ship sails on: the sea flows past it, bow (+z) to stern
    // Under way it gathers speed, and stopped it slows down, over a few
    // seconds: the wake and the ship's waves build up and die away with it
    // The ship's live speed when the data gives one; else the panel's, or the default
    const speedKnots =
      liveSceneOverrides.shipSpeedKnots ??
      (IS_SCENE_INSPECTOR_ENABLED ? SEASCAPE_TUNING.shipSpeedKnots : SHIP_SPEED_KNOTS);
    // The panel shows the speed sailed: the data's, while it gives one
    if (IS_SCENE_INSPECTOR_ENABLED) SEASCAPE_TUNING.shipSpeedKnots = speedKnots;
    const targetSpeed = isTravelingRef.current ? speedKnots * METRES_PER_SECOND_PER_KNOT : 0;
    sea.speed += (targetSpeed - sea.speed) * (1 - Math.exp(-delta / SPEED_CHANGE_TIME));
    const speed = sea.speed;
    sea.seaFrame.sail(speed * delta);
    sea.sailed += speed * delta;

    // The wind: the data's when it gives one, averaged and stepped (see LIVE_WIND_STEP_MS);
    // else the panel's, or the default. A new one raises a new sea
    const liveWind = liveSceneOverrides.wind;
    if (liveWind) {
      // The user's wind at once; the data's averaged, as a sea answers the wind of the last minutes
      sea.liveWindAverage =
        sea.liveWindAverage === null || liveWind.isUserSet
          ? liveWind.speedMs
          : sea.liveWindAverage + (liveWind.speedMs - sea.liveWindAverage) * (1 - Math.exp(-delta / LIVE_WIND_AVERAGING_S));
      if (sea.liveWindRaised === null || Math.abs(sea.liveWindAverage - sea.liveWindRaised) >= LIVE_WIND_STEP_MS) {
        sea.liveWindRaised = Math.max(LIVE_WIND_STEP_MS, Math.round(sea.liveWindAverage / LIVE_WIND_STEP_MS) * LIVE_WIND_STEP_MS);
      }
    }
    const windSpeed = liveWind
      ? (sea.liveWindRaised ?? liveWind.speedMs)
      : IS_SCENE_INSPECTOR_ENABLED
        ? SEASCAPE_TUNING.windSpeed
        : SEASCAPE_WIND.speed;
    if (IS_SCENE_INSPECTOR_ENABLED) SEASCAPE_TUNING.windSpeed = windSpeed;
    const windFrom = IS_SCENE_INSPECTOR_ENABLED ? SEASCAPE_TUNING.windFromDegrees : SEASCAPE_WIND.fromDegrees;
    const wind = windAt(windSpeed, windFrom);

    // The side the data's wind comes from, off the bow — head-on without it.
    // Set at once the first time, then followed slowly: never seen turning
    const targetSide = (liveWind?.fromRelativeDeg ?? 0) * RADIANS_PER_DEGREE;
    sea.windSide =
      sea.windSide === null
        ? targetSide
        : sea.windSide +
          (targetSide - sea.windSide) *
            (1 - Math.exp(-delta / (liveWind?.isUserSet ? USER_WIND_SIDE_SMOOTHING_S : WIND_SIDE_SMOOTHING_S)));
    // The side the user chose is every wave's; the data's, as chosen for the sense of motion
    const wavesFrom: WavesFrom = liveWind?.isUserSet
      ? "wind"
      : IS_SCENE_INSPECTOR_ENABLED
        ? SEASCAPE_TUNING.wavesFrom
        : DEFAULT_WAVES_FROM;
    const directions = waveDirections(wavesFrom, sea.windSide);

    const key = `${windKey(wind)}|${directions.shortWavesTurnDeg}`;
    if (key !== sea.oceanWindKey) {
      if (sea.ocean && sea.fft) {
        sea.ocean.setWind(wind, directions.shortWavesTurnDeg);
        sea.fft.syncTileSizes();
      }
      applyWindSeaState(sea.uniforms, wind, IS_SCENE_INSPECTOR_ENABLED ? SEASCAPE_TUNING.foamAmount : SEASCAPE_SURFACE_DEFAULTS.foamAmount);
      sea.oceanWindKey = key;
    }
    sceneSeaState.significantWaveHeightM = sea.uniforms.windSea.travel.value.w;

    // The waves: head-on, or from the wind's side, as chosen (see `seascape-wave-direction.ts`)
    const travel = sea.uniforms.windSea.travel.value;
    sea.seaFrame.turnTo(headOnTurn(travel.x, travel.y) + directions.frameTurnFromHeadOn);

    // The wind round the ship: the true wind, from its side, less the ship's
    // own way through the air (the bow is +z, starboard -x)
    apparentWind.x = windSpeed * Math.sin(sea.windSide);
    apparentWind.z = -(windSpeed * Math.cos(sea.windSide) + speed);
    sea.precipitation.update(apparentWind, delta);
    sea.uniforms.shipSpeed.value = speed;
    shipMotionState.speed = speed;
    sea.bubbles.uniforms.speed.value = speed;
    sea.bubbles.uniforms.shipY.value = shipMotionState.shipY;
    // The bow wave and its spray: the faster the ship, and the rougher the sea, the more
    const waveHeight = sea.uniforms.windSea.travel.value.w;
    bowWave.speed.value = speed;
    bowWave.waveHeight.value = waveHeight;
    sea.bowSpray.uniforms.speed.value = speed;
    sea.bowSpray.uniforms.intensity.value =
      smoothStep(SPRAY_FROM_SPEED, SPRAY_FULL_SPEED, speed) *
      (SPRAY_CALM_SHARE + (1 - SPRAY_CALM_SHARE) * smoothStep(SPRAY_FROM_WAVES, SPRAY_FULL_WAVES, waveHeight));
    sea.kelvinTrack.update(speed * delta, speed, delta);

    // The sea's height at every probe: under the ship, at the buoys, over the camera
    const sailed = sea.sailed;
    sea.probes?.setPoints(sea.probePointsFor(sailed, camera.position.x, camera.position.z));
    const heights = sea.probes ? sea.probes.update(asSceneRenderer(gl)) : null;
    const { ship: shipProbes, buoys: buoyProbes } = sea.probeLayout;

    // Under the water or above it: the water's height right over the camera
    const waterAbove = SEASCAPE_SURFACE_LEVEL_Y + (heights?.[shipProbes + buoyProbes] ?? 0);
    // Inside the hull the camera is dry, whatever the sea outside: seen from
    // there — the engine room, with a part focused — the underwater view only
    // washed the ship out. The ship stays at the origin, bow to +z
    const isInsideHull =
      Math.abs(camera.position.x) < SEASCAPE_SHIP_HULL.halfBeam &&
      Math.abs(camera.position.z) < SEASCAPE_SHIP_HULL.halfLength &&
      camera.position.y > SEASCAPE_SURFACE_LEVEL_Y - SEASCAPE_SHIP_HULL.depthBelowWater;
    const underBy = isInsideHull ? -Infinity : waterAbove - camera.position.y;
    underwater.submerged.value = Math.min(Math.max(underBy / WATERLINE_BLEND + 0.5, 0), 1);
    underwater.depth.value = Math.max(underBy, 0);
    underwater.isCameraInsideHull.value = isInsideHull && waterAbove > camera.position.y ? 1 : 0;

    // The buoys stay where they are moored in the sea, so they fall behind
    sea.buoys.update(sailed, heights ? heights.subarray(shipProbes, shipProbes + buoyProbes) : null, delta);

    // The ship, carried by the sea under it
    if (heights) sea.shipMotion.update(heights.subarray(0, shipProbes), delta, speed);

    // The hull foam's footprint: now and then, and when its distance changes
    const contactFoamDistance = IS_SCENE_INSPECTOR_ENABLED
      ? SEASCAPE_TUNING.contactFoamDistance
      : CONTACT_FOAM_DISTANCE;
    sea.framesSinceContactFoam++;
    if (
      sea.framesSinceContactFoam >= CONTACT_FOAM_REDRAW_FRAMES ||
      contactFoamDistance !== sea.contactFoamDistance
    ) {
      sea.contactFoam.uniforms.distance.value = contactFoamDistance;
      // The highest the sea can rise: the crests of the tallest waves
      const highestWater = sea.uniforms.windSea.travel.value.w * HIGHEST_CREST_OF_HS;
      // Without the buoys: the footprint's override material would draw them all
      // at their geometry's origin, inside the hull, not where their instances are
      sea.contactFoam.update(
        asSceneRenderer(gl),
        scene,
        [mesh, sea.buoys.mesh, sea.bubbles.sprite, sea.bowSpray.sprite, sea.precipitation.sprite],
        highestWater
      );
      sea.framesSinceContactFoam = 0;
      sea.contactFoamDistance = contactFoamDistance;
    }

    // The wake flows back from the stern as the ship sails on
    // ...only while there is a wake: under way, and for a while after
    sea.stillSeconds = speed > 0.01 ? 0 : sea.stillSeconds + delta;
    const hasWake = sea.stillSeconds < WAKE_SETTLE_SECONDS;
    if (hasWake) sea.wake.update(asSceneRenderer(gl), delta, speed);
    // The foam the crests leave, flowing past with the water: always, the sea breaks at rest too
    sea.foamMemory?.update(asSceneRenderer(gl), delta, speed);
    // ...and the sea's shader skips the wake, and the ship's waves, once they are gone
    sea.uniforms.hasWake.value = hasWake ? 1 : 0;
    sea.uniforms.hasShipWaves.value = sea.stillSeconds < SHIP_WAVES_SETTLE_SECONDS ? 1 : 0;

    // Not drawn when there is nothing to see: the propellers' bubbles only
    // under way, and only from under the water (the sea hides them from
    // above); rain and snow only when falling
    sea.bubbles.sprite.visible = speed > STILL_SPEED && underwater.submerged.value > 0;
    sea.bowSpray.sprite.visible = speed > STILL_SPEED && underwater.submerged.value < 0.5;
    sea.precipitation.sprite.visible = weatherState.rain > 0 || weatherState.snow > 0;

    // Applied per frame rather than through change handlers, as SceneLights
    // does: a few assignments, and it cannot drift out of sync with the panel.
    if (!IS_SCENE_INSPECTOR_ENABLED) return;

    // A new density means a new grid, and the shader must know its cell size
    // (the select hands back the option as it was given, a number)
    const segments = Number(SEASCAPE_TUNING.gridSegments);
    if (segments !== sea.segments) {
      sea.geometry.dispose();
      sea.geometry = createSeaGeometry(segments);
      sea.segments = segments;
      sea.uniforms.cellSize.value = cellSizeFor(segments);
      mesh.geometry = sea.geometry;
    }

    // The panel's foam amount on the sea the wind raised (the wind is applied above)
    applyWindSeaState(sea.uniforms, wind, SEASCAPE_TUNING.foamAmount);
    sea.uniforms.antiAliasing.value = SEASCAPE_TUNING.antiAliasing ? 1.0 : 0.0;
    sea.uniforms.reflectivity.value = SEASCAPE_TUNING.reflectivity;
    sea.uniforms.deepColor.value.set(SEASCAPE_TUNING.deepColor);
    sea.uniforms.lightColor.value.set(SEASCAPE_TUNING.lightColor);
    sea.uniforms.foamColor.value.set(SEASCAPE_TUNING.foamColor);
    sea.uniforms.foamMap.value = getFoamTexture(SEASCAPE_TUNING.foamTexture);
    sea.uniforms.subsurfaceColor.value.set(SEASCAPE_TUNING.subsurfaceColor);
    sea.uniforms.subsurfaceStrength.value = SEASCAPE_TUNING.subsurfaceStrength;
    sea.uniforms.scatterColor.value.set(SEASCAPE_TUNING.scatterColor);
    sea.uniforms.scatterStrength.value = SEASCAPE_TUNING.scatterStrength;
    sea.uniforms.shininess.value = SEASCAPE_TUNING.shininess;
    sea.uniforms.leftFoamStrength.value = SEASCAPE_TUNING.leftFoam;
    sea.uniforms.residualFoamStrength.value = SEASCAPE_TUNING.residualFoam;
    sea.uniforms.bodyLightStrength.value = SEASCAPE_TUNING.bodyLight;
    sea.uniforms.waterAbsorption.value = SEASCAPE_TUNING.waterAbsorption;
    sea.uniforms.refraction.value = SEASCAPE_TUNING.refraction;
    // Only on a change: switching to lines rebuilds the material's pipeline
    if (sea.material.wireframe !== SEASCAPE_TUNING.wireframe) {
      sea.material.wireframe = SEASCAPE_TUNING.wireframe;
      sea.material.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[0, SEASCAPE_SURFACE_LEVEL_Y, 0]}
        // Before the other blended things (the faded parts of the ship): they are drawn over the sea, not under it
        renderOrder={SEA_RENDER_ORDER}
      />
      <primitive object={seaRef.current.buoys.mesh} />
      <primitive object={seaRef.current.bubbles.sprite} />
      <primitive object={seaRef.current.bowSpray.sprite} />
      <primitive object={seaRef.current.precipitation.sprite} />
    </>
  );
}
