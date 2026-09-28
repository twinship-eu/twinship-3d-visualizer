"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
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
  SEASCAPE_SURFACE_GRID_SEGMENT_OPTIONS,
  SEASCAPE_SURFACE_GRID_SEGMENTS,
  SEASCAPE_SURFACE_GRID_SIZE,
  SEASCAPE_SURFACE_LEVEL_Y,
  SEASCAPE_SURFACE_SCALE,
  SEASCAPE_WIND,
  SEASCAPE_WIND_LIMITS,
  type SeascapeFoamTextureName,
} from "../lib/seascape-config";
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
  return SEASCAPE_SURFACE_GRID_SIZE / segments;
}

/** Rounds to the nearest vertex, so moving the grid never shifts where vertices land. */
function snapToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}

/** The flat grid the sea is drawn on, lying in the xz plane. */
function createSeaGeometry(segments: number): PlaneGeometry {
  const geometry = new PlaneGeometry(SEASCAPE_SURFACE_GRID_SIZE, SEASCAPE_SURFACE_GRID_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

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

  const nodes = createSeascapeSurfaceNodes({
    scale: SEASCAPE_SURFACE_SCALE,
    levelY: SEASCAPE_SURFACE_LEVEL_Y,
    cellSize: cellSizeFor(SEASCAPE_SURFACE_GRID_SEGMENTS),
    wind: INITIAL_WIND,
    foamTexture: getFoamTexture(SEASCAPE_DEFAULT_FOAM_TEXTURE),
    detailNormalsTexture: loadDetailNormalsTexture(),
    sunDirection: getSunDirection(),
    fft,
  });
  const material = new MeshBasicNodeMaterial();
  material.positionNode = nodes.positionNode;
  // fragmentNode rather than colorNode: the shader lights itself, and the
  // material's own logic would otherwise apply the scene's environment map.
  material.fragmentNode = nodes.fragmentNode;

  return {
    geometry,
    segments: SEASCAPE_SURFACE_GRID_SEGMENTS as number,
    material,
    uniforms: nodes.uniforms,
    ocean,
    fft,
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
    panel.add(SEASCAPE_TUNING, "wireframe");
  }, [gl]);

  useFrame(({ camera, clock }) => {
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
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, SEASCAPE_SURFACE_LEVEL_Y, 0]}
    />
  );
}
