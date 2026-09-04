import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from "three/webgpu";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import type { Renderer } from "@react-three/fiber";
export { IS_SCENE_INSPECTOR_ENABLED } from "./3d-scene-config";
import { IS_SCENE_INSPECTOR_ENABLED } from "./3d-scene-config";

/** Tone mapping exposure; higher for midday (0.1 = dusk, ~0.3 = noon). */
const TONE_MAPPING_EXPOSURE = 0.3;

/** Query param pinning the renderer to the WebGL2 backend, for reproducing fallback bugs. */
const FORCE_WEBGL_PARAM = "forceWebGL";

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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

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
