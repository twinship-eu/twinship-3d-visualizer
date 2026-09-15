import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  WebGPURenderer,
} from "three/webgpu";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import type { Renderer } from "@react-three/fiber";
import { IS_SCENE_INSPECTOR_ENABLED } from "./3d-scene-config";

/**
 * Tone mapping exposure; higher for midday (0.1 = dusk, ~0.3 = noon).
 *
 * Scales the whole image, sky included, unlike the light intensities in
 * `3d-scene-config.ts`, which reach only what they illuminate.
 */
export const TONE_MAPPING_EXPOSURE = 0.6;

/** Query param pinning the renderer to the WebGL2 backend, for reproducing fallback bugs. */
const FORCE_WEBGL_PARAM = "forceWebGL";

/**
 * Query param that skips the sky PMREM and enables the mobile fill lights,
 * so that path can be tuned on desktop before deploying phone values.
 */
const FORCE_NO_ENV_PARAM = "forceNoEnv";

/**
 * Whether the page is running under an Android user agent.
 *
 * Guarded for SSR: this module is pulled in by client components that Next
 * still evaluates on the server. The server answer is "not Android".
 */
export function isAndroidUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Whether the page is running under an iPhone / iPad / iPod user agent.
 *
 * Also treats iPadOS "desktop" Safari (Macintosh UA + touch) as iOS, because
 * that agent still hits the same WebKit GPU path as the phone.
 *
 * Guarded for SSR like `isAndroidUserAgent`.
 */
export function isIOSUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ can report as Macintosh when requesting the desktop site.
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/**
 * Reads the `?forceNoEnv` escape hatch. Guarded for SSR like `?forceWebGL`.
 */
function shouldForceNoEnv(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(FORCE_NO_ENV_PARAM);
}

/**
 * Devices (and the desktop preview flag) that must not use the sky PMREM.
 *
 * Android blacks the metallic hull out; iOS Safari paints it a flat saturated
 * blue with the same jagged edge sparkle. Both recover under sun + fill lights
 * with the probe cleared — the path tuned via `?forceNoEnv`.
 */
export function needsNoEnvLightingPath(): boolean {
  return shouldForceNoEnv() || isAndroidUserAgent() || isIOSUserAgent();
}

/**
 * Whether `WaterMesh` planar reflections may run on this device.
 *
 * The mirrored scene pass shows up on phones as flickering triangles along the
 * left/right of the water, on both WebGPU and WebGL2 (`?forceWebGL` does not
 * clear it). Desktop keeps the reflector; Android and iOS use the flat water
 * path instead.
 */
export function canUseWaterReflections(): boolean {
  return !isAndroidUserAgent() && !isIOSUserAgent();
}

/**
 * Whether shadows can be rendered at all on this device.
 *
 * three refuses depth-texture comparison on any user agent containing
 * "Android", as a blanket workaround for Android WebGPU drivers:
 *
 *   WebGPUBackend.js
 *   const compatibilityTextureCompare =
 *     typeof navigator === 'undefined' ? true
 *       : /Android/.test( navigator.userAgent ) === false;
 *
 * Its own shadow code does not honour that. ShadowNode always sets the depth
 * texture's compareFunction to LessEqualCompare, while the no-compare fallback
 * in TextureNode handles only null or LessCompare, so LessEqualCompare falls
 * through to a branch emitting a comparison the backend cannot perform. Every
 * shadow-receiving material then compiles to an invalid fragment shader, which
 * surfaces as a wall of "Invalid ShaderModule ... invalid due to a previous
 * error" and, on a phone, no ship.
 *
 * This mirrors three's rule rather than asking the renderer, because the answer
 * is needed for React Three Fiber's `shadows` prop, which is evaluated before a
 * renderer exists. Asking `renderer.hasCompatibility` in the factory below does
 * not work: R3F re-applies that prop afterwards with
 * `gl.shadowMap.enabled = !!shadows`, overwriting whatever the factory set.
 *
 * Known conservatism: with `?forceWebGL` on an Android agent this also drops
 * shadows, though the WebGL2 backend could have drawn them. That combination is
 * a debugging path, and keeping one rule is worth more than covering it.
 *
 * iOS is included via `needsNoEnvLightingPath`: the no-env fill intensities were
 * tuned without shadows, and leaving them on would underexpose the hull again.
 */
export function canRenderShadows(): boolean {
  return !needsNoEnvLightingPath();
}

/**
 * Whether the sky-baked PMREM probe may be assigned as `scene.environment`.
 *
 * On Pixel / Mali the probe is assigned with a real size but samples badly:
 * roughness 1 metals go black, roughness 0 blows out white. On iOS Safari the
 * same probe path paints the engine ship a flat saturated blue with jagged
 * edge sparkle. Clearing `scene.environment` restores a lit, textured hull
 * under the sun and the mobile fill lights.
 *
 * Desktop keeps the bake. Android and iOS skip it. `?forceNoEnv` forces the
 * same skip on any device so the Lights panel can tune the fills on desktop.
 */
export function canAssignEnvironmentProbe(): boolean {
  return !needsNoEnvLightingPath();
}

/**
 * The slice of R3F's default renderer props this factory needs. R3F declares
 * `DefaultGLProps` but does not re-export it from the package root, and the
 * canvas is the only field a WebGPURenderer takes from it.
 *
 * `canvas` is widened to `EventTarget` deliberately: R3F declares its own stub
 * `interface OffscreenCanvas extends EventTarget {}`, which shadows the DOM type,
 * so a `HTMLCanvasElement | OffscreenCanvas` parameter here would reject the very
 * props R3F passes in.
 */
type SceneRendererProps = {
  canvas: HTMLCanvasElement | EventTarget;
};

/** Thrown when neither a WebGPU nor a WebGL2 backend could be initialised. */
export class SceneRendererInitError extends Error {
  constructor(cause: unknown) {
    super("Could not initialise a WebGPU or WebGL2 renderer for the 3D scene");
    this.name = "SceneRendererInitError";
    this.cause = cause;
  }
}

/**
 * Reads the `?forceWebGL` escape hatch. Guarded for SSR: this module is pulled
 * in by a client component that Next still evaluates on the server.
 */
function shouldForceWebGL(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(FORCE_WEBGL_PARAM);
}

async function initRenderer(
  canvas: HTMLCanvasElement | EventTarget,
  forceWebGL: boolean
): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    // R3F always creates a real canvas for the web Canvas component; the widened
    // parameter type above exists only to satisfy its stubbed OffscreenCanvas.
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    forceWebGL,
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  // Set here for a renderer built outside R3F, but R3F overwrites it from the
  // Canvas `shadows` prop straight after this factory returns. See
  // canRenderShadows above: the prop is what actually decides.
  renderer.shadowMap.enabled = canRenderShadows();
  // Soft rather than plain PCF: more taps per pixel, but the hard stair-stepped
  // edge of a single-tap lookup is obvious on a shadow this large.
  renderer.shadowMap.type = PCFSoftShadowMap;

  if (IS_SCENE_INSPECTOR_ENABLED) {
    // Must be assigned *before* init(): the renderer calls inspector.init() from
    // inside its own init(), and the `inspector` setter does not re-run it. Set
    // afterwards and the panel silently never attaches.
    renderer.inspector = new Inspector();
  }

  // Must complete before the first render and before PMREMGenerator.fromScene().
  await renderer.init();
  return renderer;
}

/**
 * Builds the scene renderer. The backend is chosen by three itself: WebGPU when
 * `navigator.gpu` resolves an adapter, WebGL2 otherwise. TSL compiles to both,
 * so there is deliberately no capability branch in application code.
 */
export async function createSceneRenderer(
  props: SceneRendererProps
): Promise<Renderer> {
  const forceWebGL = shouldForceWebGL();
  try {
    return (await initRenderer(props.canvas, forceWebGL)) as unknown as Renderer;
  } catch (error) {
    if (forceWebGL) throw new SceneRendererInitError(error);
    try {
      // A browser can advertise navigator.gpu and still fail to hand over a
      // device. Retry pinned to WebGL2 before giving up.
      return (await initRenderer(props.canvas, true)) as unknown as Renderer;
    } catch (fallbackError) {
      throw new SceneRendererInitError(fallbackError);
    }
  }
}

/**
 * Reinterprets R3F's renderer handle as the renderer this scene actually runs.
 *
 * R3F's store types `state.gl` as `THREE.WebGLRenderer`, because that is its
 * default. This scene substitutes a `WebGPURenderer` through the `gl` factory, so
 * anything needing the node renderer's API — `PMREMGenerator` from
 * `three/webgpu`, for one — has to go through here. Keeping the cast in a single
 * named function stops it from being sprinkled across components.
 */
export function asSceneRenderer(gl: unknown): WebGPURenderer {
  return gl as WebGPURenderer;
}

/**
 * Anisotropy to assume when the backend does not report a maximum.
 *
 * `WebGPURenderer.getMaxAnisotropy()` delegates to the backend, and the WebGPU
 * backend's implementation is an empty stub returning `undefined` — WebGPU has
 * no queryable limit, and three's WebGPU sampler path ignores
 * `texture.anisotropy` altogether. 16 is the cap the WebGPU spec places on
 * sampler `maxAnisotropy`, so it is the honest ceiling to record; on that
 * backend the value is inert, and on the WebGL2 fallback the real maximum is
 * reported and used instead.
 */
const ASSUMED_MAX_ANISOTROPY = 16;

/**
 * Highest anisotropic filtering level the current backend supports.
 *
 * Replaces `gl.capabilities.getMaxAnisotropy()`, which exists only on
 * `WebGLRenderer` — reading `.capabilities` on a `WebGPURenderer` throws.
 */
export function getMaxTextureAnisotropy(renderer: unknown): number {
  const reported = (
    renderer as { getMaxAnisotropy?: () => number | undefined }
  )?.getMaxAnisotropy?.();
  return reported ?? ASSUMED_MAX_ANISOTROPY;
}

/**
 * The scene's Inspector, if one was attached. Narrowed from the renderer's
 * `InspectorBase`-typed field, which does not expose `createParameters`.
 */
export function getSceneInspector(renderer: unknown): Inspector | null {
  const inspector = (renderer as { inspector?: unknown }).inspector;
  const hasParameters =
    typeof (inspector as Inspector | undefined)?.createParameters === "function";
  return hasParameters ? (inspector as Inspector) : null;
}

/** True when the renderer resolved to the WebGPU backend rather than WebGL2. */
export function isWebGPUBackend(renderer: unknown): boolean {
  const backend = (renderer as { backend?: { isWebGPUBackend?: boolean } })
    ?.backend;
  return backend?.isWebGPUBackend === true;
}
