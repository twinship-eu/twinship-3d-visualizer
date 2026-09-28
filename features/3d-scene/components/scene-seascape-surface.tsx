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
import { getSunDirection, IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import {
  IS_FFT_OCEAN_ENABLED,
  SEASCAPE_CHOP_NORMALS_URL,
  SEASCAPE_DEFAULT_FOAM_TEXTURE,
  SEASCAPE_DETAIL_NORMALS_ANISOTROPY,
  SEASCAPE_FOAM_ANISOTROPY,
  SEASCAPE_FOAM_TEXTURES,
  SEASCAPE_SHIP_HULL,
  SEASCAPE_SURFACE_GRID_SEGMENT_OPTIONS,
  SEASCAPE_SURFACE_GRID_SEGMENTS,
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
import { createWake } from "../lib/seascape-wake";
import { createSeaFrame, headOnTurn } from "../lib/seascape-sea-frame";
import { createKelvinHistory } from "../lib/seascape-kelvin-wake";
import { createBuoys } from "../lib/seascape-buoys";
import { createBubbles } from "../lib/seascape-bubbles";
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
/**
 * Texels along each side: about 25 cm each. The distance field is smooth, so
 * the foam barely differs from 2048², at a quarter of the cost — which lets it
 * be redrawn every frame.
 */
const CONTACT_FOAM_RESOLUTION = 1024;
/**
 * How far the foam reaches from the hull, in world units, to start with. A few
 * tens of centimetres are what churns right against a hull, but seen from the
 * default camera, 200 units from a ship this size, less than a unit does not
 * show; the Inspector goes down to 0.1.
 */
const CONTACT_FOAM_DISTANCE = 1.0;
const MAX_CONTACT_FOAM_DISTANCE = 10;
/**
 * How often the footprint is redrawn, in frames: every one, as the ship and
 * the water it stands in move all the time. (Every 30, the foam trailed the
 * ship's motion by up to half a second.)
 */
const CONTACT_FOAM_REDRAW_FRAMES = 1;

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

/** Identifies a wind, to notice when it changes. */
function windKey(wind: { speed: number; fromDegrees: number; fetch: number }) {
  return `${wind.speed}|${wind.fromDegrees}|${wind.fetch}`;
}

/** Builds the grid, its material and the shader's tuning uniforms, once. */
function createSeaSurface(canUseCompute: boolean) {
  const geometry = createSeaGeometry(SEASCAPE_SURFACE_GRID_SEGMENTS);
  // The FFT ocean needs compute shaders: WebGPU only. On three's WebGL
  // fallback the analytic waves are drawn instead
  const ocean = IS_FFT_OCEAN_ENABLED && canUseCompute ? createFftOcean(INITIAL_WIND) : null;
  const fft = ocean ? createFftSurfaceNodes(ocean.cascades) : undefined;
  // The ship rides the FFT ocean; on the analytic fallback it rests still
  const shipMotion = createShipMotionSolver(SEASCAPE_SHIP_HULL);
  const seaFrame = createSeaFrame();
  const waveProbes = ocean ? createWaveProbes(ocean.cascades, shipMotion.points, seaFrame.toSea) : null;
  const contactFoam = createContactFoam({
    areaSize: CONTACT_FOAM_AREA,
    resolution: CONTACT_FOAM_RESOLUTION,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
    distance: CONTACT_FOAM_DISTANCE,
    // The FFT ocean's own height, so the hull is cut at the real waterline
    waterHeight: fft ? (position) => fft.pixelWaves(seaFrame.toSea(position)).z : undefined,
  });
  const wake = createWake(contactFoam);
  const kelvinTrack = createKelvinHistory();
  // Buoys moored around the ship, riding the waves: probed like the ship
  const buoys = createBuoys(SEASCAPE_SURFACE_LEVEL_Y);
  // Kept under the real surface: the FFT ocean's height, where the sea has flowed to
  const bubbles = createBubbles(
    SEASCAPE_SURFACE_LEVEL_Y,
    fft ? (position) => fft.gridHeight(seaFrame.toSea(position), float(BUBBLE_SURFACE_FILTER)) : undefined
  );
  const buoyProbes = ocean ? createWaveProbes(ocean.cascades, buoys.probePoints(0), seaFrame.toSea) : null;
  // The water right above (or below) the camera: whether it is under water
  const cameraProbe = ocean ? createWaveProbes(ocean.cascades, [{ x: 0, z: 0 }], seaFrame.toSea) : null;

  const nodes = createSeascapeSurfaceNodes({
    scale: SEASCAPE_SURFACE_SCALE,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
    cellSize: cellSizeFor(SEASCAPE_SURFACE_GRID_SEGMENTS),
    cellGrowth: GRID_CELL_GROWTH,
    wind: INITIAL_WIND,
    foamTexture: getFoamTexture(SEASCAPE_DEFAULT_FOAM_TEXTURE),
    detailNormalsTexture: loadDetailNormalsTexture(),
    sunDirection: getSunDirection(),
    fft,
    contactFoam,
    seaFrame,
    wake,
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

  return {
    geometry,
    segments: SEASCAPE_SURFACE_GRID_SEGMENTS as number,
    material,
    uniforms: nodes.uniforms,
    ocean,
    fft,
    contactFoam,
    seaFrame,
    wake,
    kelvinTrack,
    buoys,
    bubbles,
    buoyProbes,
    cameraProbe,
    shipMotion,
    waveProbes,
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
   * `SEASCAPE_SURFACE_GRID_SEGMENTS` for measurements.
   */
  gridSegments: SEASCAPE_SURFACE_GRID_SEGMENTS as number,
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
    panel.add(SEASCAPE_TUNING, "windSpeed", 0, SEASCAPE_WIND_LIMITS.maxSpeed, 0.1);
    panel.add(SEASCAPE_TUNING, "windFromDegrees", 0, 360, 1);
    panel.add(SEASCAPE_TUNING, "antiAliasing");
    panel.add(SEASCAPE_TUNING, "reflectivity", 0, 1, 0.01);
    panel.addColor(SEASCAPE_TUNING, "deepColor");
    panel.addColor(SEASCAPE_TUNING, "lightColor");
    panel.add(SEASCAPE_TUNING, "foamAmount", 0, 1, 0.01);
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
    panel.add(SEASCAPE_TUNING, "shipSpeedKnots", 0, MAX_SHIP_SPEED_KNOTS, 0.5);
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

    // The FFT ocean's waves, brought to this moment: a few compute passes
    sea.ocean?.update(asSceneRenderer(gl), clock.elapsedTime);

    // The ship sails on: the sea flows past it, bow (+z) to stern
    // Under way it gathers speed, and stopped it slows down, over a few
    // seconds: the wake and the ship's waves build up and die away with it
    const speedKnots = IS_SCENE_INSPECTOR_ENABLED ? SEASCAPE_TUNING.shipSpeedKnots : SHIP_SPEED_KNOTS;
    const targetSpeed = isTravelingRef.current ? speedKnots * METRES_PER_SECOND_PER_KNOT : 0;
    sea.speed += (targetSpeed - sea.speed) * (1 - Math.exp(-delta / SPEED_CHANGE_TIME));
    const speed = sea.speed;
    sea.seaFrame.sail(speed * delta);
    sea.sailed += speed * delta;

    // The sea always lies with its waves coming at the bow — what makes the
    // ship read as sailing when under way. Always, not only under way: turned
    // as the ship gathered speed, the whole sea was seen swinging round it
    const travel = sea.uniforms.windSea.travel.value;
    sea.seaFrame.turnTo(headOnTurn(travel.x, travel.y));
    sea.uniforms.shipSpeed.value = speed;
    shipMotionState.speed = speed;
    sea.bubbles.uniforms.speed.value = speed;
    sea.bubbles.uniforms.shipY.value = shipMotionState.shipY;
    sea.kelvinTrack.update(speed * delta, speed, delta);

    // Under the water or above it: the water's height right over the camera
    sea.cameraProbe?.setPoints([{ x: camera.position.x, z: camera.position.z }]);
    const waterAbove = SEASCAPE_SURFACE_LEVEL_Y + (sea.cameraProbe ? sea.cameraProbe.update(asSceneRenderer(gl))[0] ?? 0 : 0);
    const underBy = waterAbove - camera.position.y;
    underwater.submerged.value = Math.min(Math.max(underBy / WATERLINE_BLEND + 0.5, 0), 1);
    underwater.depth.value = Math.max(underBy, 0);

    // The buoys stay where they are moored in the sea, so they fall behind
    const sailed = sea.sailed;
    sea.buoyProbes?.setPoints(sea.buoys.probePoints(sailed));
    sea.buoys.update(sailed, sea.buoyProbes ? sea.buoyProbes.update(asSceneRenderer(gl)) : null, delta);

    // The ship, carried by the sea under it
    if (sea.waveProbes) sea.shipMotion.update(sea.waveProbes.update(asSceneRenderer(gl)), delta, speed);

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
      sea.contactFoam.update(asSceneRenderer(gl), scene, [mesh, sea.buoys.mesh, sea.bubbles.sprite], highestWater);
      sea.framesSinceContactFoam = 0;
      sea.contactFoamDistance = contactFoamDistance;
    }

    // The wake flows back from the stern as the ship sails on
    sea.wake.update(asSceneRenderer(gl), delta, speed);

    // Applied per frame rather than through change handlers, as SceneLights
    // does: a few assignments, and it cannot drift out of sync with the panel.
    if (!IS_SCENE_INSPECTOR_ENABLED) return;

    // A new wind means a new spectrum, rebuilt on the CPU: only on a change
    const wind = windAt(SEASCAPE_TUNING.windSpeed, SEASCAPE_TUNING.windFromDegrees);
    const key = windKey(wind);
    if (sea.ocean && sea.fft && key !== sea.oceanWindKey) {
      sea.ocean.setWind(wind);
      sea.fft.syncTileSizes();
      sea.oceanWindKey = key;
    }

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

    applyWindSeaState(
      sea.uniforms,
      windAt(SEASCAPE_TUNING.windSpeed, SEASCAPE_TUNING.windFromDegrees),
      SEASCAPE_TUNING.foamAmount
    );
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
      />
      <primitive object={seaRef.current.buoys.mesh} />
      <primitive object={seaRef.current.bubbles.sprite} />
    </>
  );
}
