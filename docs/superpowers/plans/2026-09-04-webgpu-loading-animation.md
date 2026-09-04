# WebGPU Migration and TSL Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 3D scene from `WebGLRenderer` to `WebGPURenderer` with a working WebGL2 fallback, then replace the grey-box loading placeholder with a TSL "surfacing from the depths" animation driven by real load progress.

**Architecture:** Phase 1 swaps the renderer and replaces the two WebGL-only scene objects (`Sky`, `Water`) with their TSL-native equivalents (`SkyMesh`, `WaterMesh`), with no intended visual change. Phase 2 adds a fullscreen quad in the existing scene graph whose `NodeMaterial` is authored in TSL, driven by two uniforms (`depth`, `opacity`) from a phase machine that reads drei's `useProgress`.

**Tech Stack:** three 0.183.1 (`three/webgpu`, `three/tsl`), @react-three/fiber 9.5.0, @react-three/drei 10.7.7, Next 16.1.6, React 19.2.3, TypeScript 5, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-04-webgpu-loading-animation-design.md`

## Global Constraints

- **No test runner exists in this repo.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `optimize:ship-model`. Adding one is explicitly out of scope. Every task verifies with `npx tsc --noEmit` plus a browser check against the running dev server at `http://localhost:3000`.
- `npx eslint` is currently broken — `eslint-config-prettier` is missing from `node_modules`. Do not treat lint failure as your bug; do not try to fix it as part of this work.
- **WebGL fallback is a hard requirement.** Every browser verification runs twice: `http://localhost:3000` and `http://localhost:3000/?forceWebGL`.
- **Visual parity for sky and water.** Nobody should be able to tell the migration happened.
- three version floor: **0.183.1** — `SkyMesh`, `WaterMesh`, and the `PMREMGenerator` that accepts a WebGPU renderer all require it.
- `mx_worley_noise_float(texcoord, jitter)` accepts vec2 or vec3. `mx_fractal_noise_float(position, octaves, lacunarity, diminish, amplitude)` requires a **vec3** position. Passing vec2 to the fractal noise will not compile.
- Codebase conventions from `CLAUDE.md`, all enforced: named exports only (no default exports outside Next pages); internal component props typed as `type Props`; files `kebab-case`; constants `UPPER_SNAKE_CASE`; no `any` and no `as any`; prefer `type` over `interface`; no magic numbers inline; no silent `console.log` error handling; files under 300 lines.
- Do not rewrite existing `import { Group } from "three"` style imports. `three.module.js` and `three.webgpu.js` re-export from the same `three.core.js`, so core classes are the same objects through either entry point. Only `WebGPURenderer` and `PMREMGenerator` must come from `three/webgpu`.

---

## File Structure

**Phase 1 — renderer migration**

| File | Responsibility |
| --- | --- |
| Create `features/3d-scene/lib/webgpu-renderer.ts` | Build and initialise the renderer; own the fallback retry and the `?forceWebGL` escape hatch. The only file that knows which backend is in play. |
| Create `features/3d-scene/components/renderer-backend-probe.tsx` | Report the resolved backend upward (dev diagnostics only). Renders nothing. |
| Create `features/3d-scene/components/renderer-backend-badge.tsx` | Dev-only DOM badge showing WebGPU vs WebGL2. |
| Modify `features/3d-scene/3d-scene.tsx` | Use the async renderer factory; hold and display the backend readout. |
| Modify `features/3d-scene/components/scene-sky.tsx` | `Sky` → `SkyMesh`. |
| Modify `features/3d-scene/components/scene-water.tsx` | `Water` → `WaterMesh`. |
| Modify `features/3d-scene/lib/3d-scene-config.ts` | Add `cloudScale`/`cloudSpeed`, `WATER_RESOLUTION_SCALE`, `DEPTH_VEIL_TIMING`. |
| Modify `features/3d-scene/components/scene-environment-map.tsx` | `PMREMGenerator` import moves to `three/webgpu`. |
| Modify `features/ship-visualizer/lib/3d-model.ts` | Guard `needsUpdate` so it fires only on a real blend-state change. |

**Phase 2 — loading animation**

| File | Responsibility |
| --- | --- |
| Create `features/3d-scene/lib/depth-veil-shader.ts` | Pure TSL. Builds the material and returns its two uniforms. No React, no scene objects. |
| Create `features/3d-scene/components/depth-veil.tsx` | The fullscreen quad; interpolates and writes the two uniforms per frame. |
| Create `features/ship-visualizer/hooks/use-model-load-progress.ts` | The phase machine over drei's `useProgress` plus the app's own ready signal. |
| Create `features/ship-visualizer/components/depth-veil-harness.tsx` | Dev-only slider + replay control for tuning. |
| Modify `features/ship-visualizer/ship-visualizer.tsx` | Call the hook, render the veil, render the harness. |
| Modify `features/ship-visualizer/components/scene-content.tsx` | Suspense fallback becomes `null`. |

---

## Task 1: WebGPU renderer with sky, water and env map temporarily removed

Deliberately lands the renderer swap **alone**, so R3F/Next integration problems can't be confused with sky or water problems. The scene will look plainer at the end of this task — no sky, no ocean, black metal on the ship. That is expected and is fixed in tasks 2 and 3.

**Files:**
- Create: `features/3d-scene/lib/webgpu-renderer.ts`
- Create: `features/3d-scene/components/renderer-backend-probe.tsx`
- Create: `features/3d-scene/components/renderer-backend-badge.tsx`
- Modify: `features/3d-scene/3d-scene.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `createSceneRenderer(props: DefaultGLProps): Promise<Renderer>`
  - `isWebGPUBackend(renderer: unknown): boolean`
  - `SceneRendererInitError extends Error`
  - `RendererBackendProbe({ onResolved }: { onResolved: (isWebGPU: boolean) => void })`
  - `RendererBackendBadge({ isWebGPU }: { isWebGPU: boolean | null })`

- [ ] **Step 1: Write the renderer factory**

Create `features/3d-scene/lib/webgpu-renderer.ts`:

```ts
import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from "three/webgpu";
import type { DefaultGLProps, Renderer } from "@react-three/fiber";

/** Tone mapping exposure; higher for midday (0.1 = dusk, ~0.3 = noon). */
const TONE_MAPPING_EXPOSURE = 0.3;

/** Query param pinning the renderer to the WebGL2 backend, for reproducing fallback bugs. */
const FORCE_WEBGL_PARAM = "forceWebGL";

type RendererCanvas = HTMLCanvasElement | OffscreenCanvas;

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
  canvas: RendererCanvas,
  forceWebGL: boolean
): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    forceWebGL,
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
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
  props: DefaultGLProps
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

/** True when the renderer resolved to the WebGPU backend rather than WebGL2. */
export function isWebGPUBackend(renderer: unknown): boolean {
  const backend = (renderer as { backend?: { isWebGPUBackend?: boolean } })
    ?.backend;
  return backend?.isWebGPUBackend === true;
}
```

- [ ] **Step 2: Write the backend probe and badge**

Create `features/3d-scene/components/renderer-backend-probe.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { isWebGPUBackend } from "../lib/webgpu-renderer";

type Props = {
  onResolved: (isWebGPU: boolean) => void;
};

/**
 * Reports which backend the renderer resolved to. Lives inside the Canvas
 * because that is where `useThree` can reach the renderer; renders nothing.
 */
export function RendererBackendProbe({ onResolved }: Props) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    onResolved(isWebGPUBackend(gl));
  }, [gl, onResolved]);

  return null;
}
```

Create `features/3d-scene/components/renderer-backend-badge.tsx`:

```tsx
"use client";

type Props = {
  isWebGPU: boolean | null;
};

/**
 * Development-only readout of the resolved graphics backend, so it is visible at
 * a glance which path a device took.
 */
export function RendererBackendBadge({ isWebGPU }: Props) {
  if (isWebGPU === null) return null;

  return (
    <span className="pointer-events-none absolute bottom-4 left-4 z-20 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
      {isWebGPU ? "WebGPU" : "WebGL2"}
    </span>
  );
}
```

- [ ] **Step 3: Wire the renderer into the Canvas and remove sky, water and env map**

In `features/3d-scene/3d-scene.tsx`:

1. Delete the `ACESFilmicToneMapping`, `HalfFloatType` and `PCFShadowMap` imports from `"three"` and the local `TONE_MAPPING_EXPOSURE` constant — they now live in `webgpu-renderer.ts`. Keep the `Vector3` import.
2. Delete the `onCreated` prop and the whole `gl={{ ... }}` object.
3. Add `gl={createSceneRenderer}`.
4. Delete the `<SceneSky />`, `<SceneEnvironmentMap />` and `<SceneWater />` lines and their imports. **Tasks 2 and 3 restore them.**
5. Add the probe inside the Canvas and the badge as a DOM sibling.

`SceneWithInteraction` becomes:

```tsx
function SceneWithInteraction({ children }: { children: React.ReactNode }) {
  const [isOrbitControlsActive, setIsOrbitControlsActive] = useState(false);
  const [isWebGPU, setIsWebGPU] = useState<boolean | null>(null);

  return (
    <SceneInteractionProvider value={{ isOrbitControlsActive }}>
      <ZoomControlsProvider>
        <Canvas
          shadows
          camera={{
            position: new Vector3(...DEFAULT_CAMERA_POSITION),
            fov: 45,
          }}
          gl={createSceneRenderer}
        >
          <RendererBackendProbe onResolved={setIsWebGPU} />
          <SceneLights />
          {children}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={400}
            maxPolarAngle={Math.PI / 2}
            onStart={() => setIsOrbitControlsActive(true)}
            onEnd={() => setIsOrbitControlsActive(false)}
          />
          <ZoomControlsBridge />
        </Canvas>
        <ZoomControlsOverlay />
        {IS_RENDERER_BADGE_ENABLED && <RendererBackendBadge isWebGPU={isWebGPU} />}
      </ZoomControlsProvider>
    </SceneInteractionProvider>
  );
}
```

Add to `features/3d-scene/lib/3d-scene-config.ts`:

```ts
/** The backend readout is a development diagnostic, not product UI. */
export const IS_RENDERER_BADGE_ENABLED = process.env.NODE_ENV === "development";
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

If `createSceneRenderer` is rejected by `gl`'s type, the cast in Step 1 (`as unknown as Renderer`) is the fix — do not widen `GLProps` or reach for `any`.

- [ ] **Step 5: Verify in the browser, both backends**

The dev server runs at `http://localhost:3000` (start with `npm run dev` if it is not up).

1. Load `http://localhost:3000`. Expected: the ship renders against the flat `SCENE_BACKGROUND_COLOR`; orbit, zoom and selection all still work; the badge reads **WebGPU**.
2. Check the console. Expected: no errors. The two pre-existing three.js deprecation warnings (`THREE.Clock` deprecated, `PCFSoftShadowMap` deprecated) may or may not appear — anything *new* is a bug.
3. Load `http://localhost:3000/?forceWebGL`. Expected: identical, badge reads **WebGL2**.

Metallic parts of the ship will look black in this task — `scene.environment` is gone until Task 2. Do not chase it.

- [ ] **Step 6: Commit**

```bash
git add features/3d-scene/lib/webgpu-renderer.ts \
        features/3d-scene/components/renderer-backend-probe.tsx \
        features/3d-scene/components/renderer-backend-badge.tsx \
        features/3d-scene/3d-scene.tsx \
        features/3d-scene/lib/3d-scene-config.ts
git commit -m "Render the scene with WebGPURenderer and a WebGL2 fallback

TSL needs the node-material pipeline, which the classic WebGLRenderer
cannot run. The backend is left to three: WebGPU where an adapter is
available, WebGL2 otherwise, with ?forceWebGL to reproduce the fallback
on a capable machine.

Sky, water and the environment map are removed in this commit and
restored in the next two: they are the only WebGL-only objects in the
scene, and keeping them out isolates renderer integration problems from
their migration."
```

---

## Task 2: Sky via SkyMesh, and the environment map restored

**Files:**
- Modify: `features/3d-scene/components/scene-sky.tsx`
- Modify: `features/3d-scene/components/scene-environment-map.tsx`
- Modify: `features/3d-scene/lib/3d-scene-config.ts`
- Modify: `features/3d-scene/3d-scene.tsx`

**Interfaces:**
- Consumes: `createSceneRenderer` (Task 1) already in place.
- Produces: `createSky(): SkyMesh` — same name and role as before, now returning a `SkyMesh`. Task 3 does not depend on it; `scene-environment-map.tsx` does.

- [ ] **Step 1: Add the two new cloud constants**

In `features/3d-scene/lib/3d-scene-config.ts`, extend `SKY_UNIFORMS` and delete `CLOUD_ANIMATION_SPEED` (nothing will reference it after this task):

```ts
export const SKY_UNIFORMS = {
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  cloudCoverage: 0.4,
  cloudDensity: 0.5,
  cloudElevation: 0.5,
  /** Spatial frequency of the cloud noise. Larger = smaller, busier clouds. */
  cloudScale: 0.0002,
  /**
   * Cloud drift rate. SkyMesh advances clouds from TSL's global `time`, which
   * replaces the manual per-frame clock the GLSL Sky needed.
   */
  cloudSpeed: 0.0001,
} as const;
```

- [ ] **Step 2: Rewrite scene-sky.tsx against SkyMesh**

Replace the whole body of `features/3d-scene/components/scene-sky.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";
import { getSunDirection, SKY_SCALE, SKY_UNIFORMS } from "../lib/3d-scene-config";

/** Builds a Sky configured from SKY_UNIFORMS. Also used to bake the scene IBL. */
export function createSky(): SkyMesh {
  const sky = new SkyMesh();
  sky.scale.setScalar(SKY_SCALE);
  sky.sunPosition.value.copy(getSunDirection());
  sky.turbidity.value = SKY_UNIFORMS.turbidity;
  sky.rayleigh.value = SKY_UNIFORMS.rayleigh;
  sky.mieCoefficient.value = SKY_UNIFORMS.mieCoefficient;
  sky.mieDirectionalG.value = SKY_UNIFORMS.mieDirectionalG;
  sky.cloudCoverage.value = SKY_UNIFORMS.cloudCoverage;
  sky.cloudDensity.value = SKY_UNIFORMS.cloudDensity;
  sky.cloudElevation.value = SKY_UNIFORMS.cloudElevation;
  sky.cloudScale.value = SKY_UNIFORMS.cloudScale;
  sky.cloudSpeed.value = SKY_UNIFORMS.cloudSpeed;
  return sky;
}

/**
 * The sky needs no per-frame work: SkyMesh drives its cloud drift from TSL's
 * global `time` node, so the clock-advancing `useFrame` the GLSL Sky required is
 * gone along with its ref.
 */
export function SceneSky() {
  const sky = useMemo(() => createSky(), []);

  return <primitive object={sky} />;
}
```

Note the uniform access change: `material.uniforms.turbidity.value` becomes `sky.turbidity.value`. The `SkyUniforms` type and the `useFrame`/`useRef` imports all go away.

- [ ] **Step 3: Point the env map at the WebGPU PMREMGenerator**

In `features/3d-scene/components/scene-environment-map.tsx`, change one import line:

```ts
import { PMREMGenerator } from "three/webgpu";
import { Scene } from "three";
```

Nothing else changes. `fromScene()` stays synchronous — it warns only when called before the backend is initialised, and `createSceneRenderer` already awaits `renderer.init()` before R3F ever receives the renderer. (`fromSceneAsync` is deprecated as of r181; do not use it.)

- [ ] **Step 4: Restore both components in the scene**

In `features/3d-scene/3d-scene.tsx`, re-add the imports and place them as the first children inside `<Canvas>`, before `<SceneLights />`:

```tsx
<SceneSky />
<SceneEnvironmentMap />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Verify parity in the browser, both backends**

1. `http://localhost:3000` — expected: sky gradient and clouds present; the ship's metallic parts are lit rather than black; badge reads WebGPU.
2. Leave the page open for ~30 seconds. Expected: clouds drift slowly. If they are frozen, `cloudSpeed` is zero or `time` is not advancing; if they race, `cloudSpeed` is too high — it is deliberately tiny (`0.0001`).
3. `http://localhost:3000/?forceWebGL` — expected: the same sky.
4. Compare against the pre-migration look. `git stash` is not needed: check out `e72d4f6` in a second worktree if a side-by-side is wanted, otherwise judge against the screenshots taken before Task 1.

- [ ] **Step 7: Commit**

```bash
git add features/3d-scene/components/scene-sky.tsx \
        features/3d-scene/components/scene-environment-map.tsx \
        features/3d-scene/lib/3d-scene-config.ts \
        features/3d-scene/3d-scene.tsx
git commit -m "Migrate the sky to SkyMesh and restore the IBL bake

SkyMesh is the TSL implementation of the same model and already carries
the cloud uniforms, so this is a near-mechanical swap: uniform access
moves from material.uniforms.x.value to mesh.x.value, and the per-frame
clock advance is replaced by the built-in cloudSpeed, which reads TSL's
global time node.

PMREMGenerator now comes from three/webgpu. fromScene() stays
synchronous because the renderer factory awaits renderer.init() before
R3F receives the renderer."
```

---

## Task 3: Water via WaterMesh

**Files:**
- Modify: `features/3d-scene/components/scene-water.tsx`
- Modify: `features/3d-scene/lib/3d-scene-config.ts`
- Modify: `features/3d-scene/3d-scene.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 beyond the renderer being in place.
- Produces: `SceneWater()` — unchanged export name and signature.

- [ ] **Step 1: Replace the texture-size options with a resolution scale**

`WaterMesh` has no `textureWidth`/`textureHeight`; its reflection resolution is a single `resolutionScale` (default `0.5`). In `features/3d-scene/lib/3d-scene-config.ts`, replace those two keys:

```ts
/** Water options from three.js ocean example. */
export const WATER_OPTIONS = {
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
} as const;

/**
 * Reflection render-target scale for the water. WaterMesh replaces the old
 * textureWidth/textureHeight pair (512×512) with this single factor; 0.5 is its
 * default and the closest match at typical viewport sizes.
 */
export const WATER_RESOLUTION_SCALE = 0.5;
```

- [ ] **Step 2: Rewrite scene-water.tsx against WaterMesh**

Replace the whole body of `features/3d-scene/components/scene-water.tsx`:

```tsx
"use client";

import { Suspense, useMemo } from "react";
import { WaterMesh } from "three/examples/jsm/objects/WaterMesh.js";
import { PlaneGeometry, RepeatWrapping } from "three";
import { useTexture } from "@react-three/drei";
import {
  getSunDirection,
  WATER_NORMALS_URL,
  WATER_OPTIONS,
  WATER_PLANE_SIZE,
  WATER_RESOLUTION_SCALE,
} from "../lib/3d-scene-config";

/** Height of the ocean plane, below the ship's own vertical offset. */
const WATER_Y = -5;

function SceneWaterMesh() {
  const waterNormals = useTexture(WATER_NORMALS_URL);
  waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

  const water = useMemo(() => {
    const geometry = new PlaneGeometry(WATER_PLANE_SIZE, WATER_PLANE_SIZE);
    const mesh = new WaterMesh(geometry, {
      waterNormals,
      sunDirection: getSunDirection(),
      sunColor: WATER_OPTIONS.sunColor,
      waterColor: WATER_OPTIONS.waterColor,
      distortionScale: WATER_OPTIONS.distortionScale,
      resolutionScale: WATER_RESOLUTION_SCALE,
    });
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }, [waterNormals]);

  return <primitive object={water} position={[0, WATER_Y, 0]} />;
}

export function SceneWater() {
  return (
    <Suspense fallback={null}>
      <SceneWaterMesh />
    </Suspense>
  );
}
```

Three things are deliberately gone:

- The `useFrame` that advanced `uniforms.time` — `WaterMesh` reads TSL's global `time` directly.
- The `useFrame` that re-copied `sunDirection` every frame — `getSunDirection()` is a pure function of two module constants and never changes, so setting it once at construction is equivalent.
- The `fog: scene.fog !== undefined` option, which `WaterMesh` does not accept. This is a no-op: `3d-scene.tsx` never mounts `SceneEnvironment`, so `scene.fog` was always `undefined` and the flag was always `false`. The `useThree` import goes with it.

- [ ] **Step 3: Restore water in the scene**

In `features/3d-scene/3d-scene.tsx`, re-add the `SceneWater` import and place `<SceneWater />` after `<SceneEnvironmentMap />`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Verify parity in the browser, both backends**

1. `http://localhost:3000` — expected: the ocean is back, animating, with sun glint and the ship's reflection; the hull sits in the water at the same height as before.
2. `http://localhost:3000/?forceWebGL` — expected: the same ocean. Water reflections go through a `reflector()` node, which is the most likely thing to differ between backends, so look at it specifically here.
3. Confirm the water animates on its own. A static ocean means the global `time` node is not advancing.

- [ ] **Step 6: Commit**

```bash
git add features/3d-scene/components/scene-water.tsx \
        features/3d-scene/lib/3d-scene-config.ts \
        features/3d-scene/3d-scene.tsx
git commit -m "Migrate the water to WaterMesh

WaterMesh takes the same options as uniform properties and reads TSL's
global time node, so both per-frame hooks go away: the time advance and
the sunDirection re-copy, the latter of which was recomputing a constant
every frame.

textureWidth/textureHeight are replaced by a single resolutionScale, and
the fog option is dropped — WaterMesh has none, and scene.fog was always
undefined here because SceneEnvironment is never mounted."
```

---

## Task 4: Stop invalidating material pipelines on every hover

The WebGPU best-practice fix from the spec. Correct under both renderers, so it is not a WebGPU concession.

**Files:**
- Modify: `features/ship-visualizer/lib/3d-model.ts:313-319` and `:349-361`

**Interfaces:**
- Consumes: nothing.
- Produces: no signature changes. `applySelectionOpacity` keeps its exact parameter list.

- [ ] **Step 1: Guard the reset path**

In `applySelectionOpacity`, the early-return branch (around line 313) currently ends each material with an unconditional `needsUpdate`. Replace that block's body:

```ts
materials.forEach((m: Material) => {
  const base = getOrInitMaterialBaseState(m);
  const mat = m as Material & {
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    needsUpdate?: boolean;
  };
  // Only a blend-state change needs the material revalidated. Under WebGPU an
  // unconditional needsUpdate rebuilds the render pipeline, which on the hover
  // path means a shader recompile per pointer move.
  if (mat.transparent !== base.transparent) mat.needsUpdate = true;
  mat.opacity = base.opacity;
  mat.transparent = base.transparent;
  mat.depthWrite = base.depthWrite;
});
```

- [ ] **Step 2: Guard the selection path**

In the same function's `root.traverse` block (around line 349), replace the body of `materials.forEach`:

```ts
materials.forEach((m: Material) => {
  const base = getOrInitMaterialBaseState(m);
  const isDimmed = opacity < 1;
  const targetOpacity = isDimmed ? base.opacity * opacity : base.opacity;
  const targetTransparent = isDimmed ? true : base.transparent;
  const targetDepthWrite = isDimmed ? false : base.depthWrite;

  const mat = m as Material & {
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    needsUpdate?: boolean;
  };
  if (mat.transparent !== targetTransparent) mat.needsUpdate = true;
  mat.opacity = targetOpacity;
  mat.transparent = targetTransparent;
  mat.depthWrite = targetDepthWrite;
});
```

`transparent` flips only between dimmed and undimmed, while `opacity` changes on every hover — so this removes nearly every recompile without changing behaviour.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify hover and selection still look right, and are smoother**

1. `http://localhost:3000` — hover several tree items in the left panel in quick succession, then hover meshes in the viewport. Expected: unselected parts dim exactly as before; hovering is visibly smoother than in Task 3 (no per-move recompile hitch).
2. Click a part, then press Escape. Expected: opacity returns fully to normal with no part left stuck translucent. **This is the regression to watch for** — if a mesh stays see-through, a `transparent` flip is being missed and the guard is wrong.
3. `http://localhost:3000/?forceWebGL` — repeat step 2.

- [ ] **Step 5: Commit**

```bash
git add features/ship-visualizer/lib/3d-model.ts
git commit -m "Invalidate ship materials only when blend state actually changes

applySelectionOpacity set needsUpdate on every material it touched, so
every pointer move over the ship revalidated materials. Under WebGPU that
rebuilds the render pipeline and recompiles shaders, which showed as a
hitch while hovering.

opacity alone needs no revalidation; transparent does, and it flips only
between dimmed and undimmed. Guarding on that change keeps the behaviour
identical and is the correct thing under WebGL too."
```

---

## Task 5: The veil quad, a minimal shader, and the dev harness

First visible payoff, and the tool the next task needs. The shader here is deliberately crude — gradient plus caustics, no god-rays, motes or silhouette — because its job is to prove the TSL pipeline works end to end on both backends.

**Files:**
- Create: `features/3d-scene/lib/depth-veil-shader.ts`
- Create: `features/3d-scene/components/depth-veil.tsx`
- Create: `features/ship-visualizer/components/depth-veil-harness.tsx`
- Modify: `features/3d-scene/lib/3d-scene-config.ts`
- Modify: `features/ship-visualizer/ship-visualizer.tsx`

**Interfaces:**
- Consumes: `createSceneRenderer` (Task 1) — the veil cannot work without a node renderer.
- Produces:
  - `createDepthVeilMaterial(): { material: MeshBasicNodeMaterial; uniforms: DepthVeilUniforms }`
  - `type DepthVeilUniforms = { depth: UniformNode<number>; opacity: UniformNode<number> }`
  - `DepthVeil({ depth, opacity }: { depth: number; opacity: number })`
  - `DepthVeilHarness({ depth, onDepthChange, onReplay }: {...})`
  - `IS_DEPTH_VEIL_HARNESS_ENABLED: boolean`

- [ ] **Step 1: Write the minimal TSL shader**

Create `features/3d-scene/lib/depth-veil-shader.ts`:

```ts
import { Color } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  float,
  mix,
  mx_worley_noise_float,
  oneMinus,
  positionGeometry,
  screenUV,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

/**
 * Colours are authored to be seen *through* the scene's ACES tone mapping at
 * exposure 0.3, because the veil is deliberately left tone-mapped: it dissolves
 * into a tone-mapped scene, and turning it off would show a contrast jump at the
 * handoff. Expect these to look brighter in a colour picker than on screen.
 */
const ABYSS_COLOR = new Color("#04101c");
const SURFACE_COLOR = new Color("#2f9ec4");
/** Accent borrowed from SELECTED_PART_COLOR so the effect belongs to this app. */
const CAUSTIC_COLOR = new Color("#b69cff");

const CAUSTIC_SCALE = 5;
const CAUSTIC_SCALE_RATIO = 1.35;
const CAUSTIC_DRIFT = 0.06;
const CAUSTIC_SHARPNESS = 6;

export type DepthVeilUniforms = {
  depth: ReturnType<typeof uniform<number>>;
  opacity: ReturnType<typeof uniform<number>>;
};

/**
 * Two counter-scrolling Worley layers, differenced and sharpened, give the
 * bright interlocking web that reads as caustic light. Contrast rises as depth
 * falls, so the abyss is nearly flat and the surface is dazzling.
 */
const caustics = Fn(([depthLevel]: [ReturnType<typeof float>]) => {
  const drift = time.mul(CAUSTIC_DRIFT);
  const uvA = screenUV.mul(CAUSTIC_SCALE).add(vec2(drift, drift.mul(0.6)));
  const uvB = screenUV
    .mul(CAUSTIC_SCALE * CAUSTIC_SCALE_RATIO)
    .sub(vec2(drift.mul(0.8), drift.mul(0.35)));
  const web = mx_worley_noise_float(uvA).sub(mx_worley_noise_float(uvB)).abs();
  return oneMinus(web).pow(CAUSTIC_SHARPNESS).mul(oneMinus(depthLevel));
});

/** Vertical ramp from abyss to surface, re-mapped by depth so rising reads as rising. */
const abyssGradient = Fn(([depthLevel]: [ReturnType<typeof float>]) => {
  const height = screenUV.y.mul(0.5).add(oneMinus(depthLevel).mul(0.5));
  return mix(vec3(ABYSS_COLOR), vec3(SURFACE_COLOR), height.clamp(0, 1));
});

/**
 * Builds the veil material. `depth` runs 1 (abyss) → 0 (surface); `opacity`
 * drives the dissolve. Everything else comes from `time` and `screenUV`, so a
 * frame costs two scalar uniform writes and never invalidates the pipeline.
 */
export function createDepthVeilMaterial(): {
  material: MeshBasicNodeMaterial;
  uniforms: DepthVeilUniforms;
} {
  const depth = uniform(1);
  const opacity = uniform(1);

  const water = abyssGradient(depth);
  const light = caustics(depth).mul(vec3(CAUSTIC_COLOR));

  const material = new MeshBasicNodeMaterial();
  // A 2x2 plane's positions are already clip-space, so writing them straight to
  // the vertex output covers the viewport regardless of where the camera is.
  material.vertexNode = vec4(positionGeometry.xy, 0, 1);
  material.colorNode = water.add(light);
  material.opacityNode = opacity;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;

  return { material, uniforms: { depth, opacity } };
}
```

- [ ] **Step 2: Write the veil component**

Create `features/3d-scene/components/depth-veil.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createDepthVeilMaterial } from "../lib/depth-veil-shader";
import { DEPTH_VEIL_TIMING } from "../lib/3d-scene-config";

/** Renders in front of everything else in the scene. */
const VEIL_RENDER_ORDER = 999;

type Props = {
  /** 1 = abyss, 0 = surface. */
  depth: number;
  /** 1 = fully covering, 0 = fully dissolved. */
  opacity: number;
};

/**
 * A fullscreen quad carrying the loading shader.
 *
 * Targets arrive as props but are *interpolated here*, in useFrame, and written
 * straight to the uniforms. Driving them through React state would re-render at
 * frame rate during the very load this is covering.
 */
export function DepthVeil({ depth, opacity }: Props) {
  const { material, uniforms } = useMemo(() => createDepthVeilMaterial(), []);
  const targets = useRef({ depth, opacity });
  targets.current = { depth, opacity };

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    // Exponential smoothing, framerate-independent so a long frame cannot snap.
    const k = 1 - Math.exp(-DEPTH_VEIL_TIMING.SMOOTHING_RATE * delta);
    uniforms.depth.value += (targets.current.depth - uniforms.depth.value) * k;
    uniforms.opacity.value +=
      (targets.current.opacity - uniforms.opacity.value) * k;
  });

  return (
    <mesh renderOrder={VEIL_RENDER_ORDER} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
```

Add to `features/3d-scene/lib/3d-scene-config.ts`:

```ts
/**
 * Timing for the loading veil. Read by both the phase machine and the component
 * that interpolates toward its targets, so it lives here rather than in either.
 */
export const DEPTH_VEIL_TIMING = {
  /** Grace period before the veil appears at all; a warm load never shows it. */
  SHOW_DELAY_MS: 120,
  /** Once shown, stay up at least this long so a fast load still reads as a rise. */
  MIN_VISIBLE_MS: 700,
  /** Breaking the surface. */
  SURFACE_MS: 500,
  /** Cross-fade into the live scene. */
  DISSOLVE_MS: 800,
  /** Exponential smoothing rate for depth and opacity, per second. */
  SMOOTHING_RATE: 6,
} as const;
```

- [ ] **Step 3: Write the dev harness**

Create `features/ship-visualizer/components/depth-veil-harness.tsx`:

```tsx
"use client";

type Props = {
  depth: number;
  onDepthChange: (depth: number) => void;
  onReplay: () => void;
};

/**
 * Development-only control for tuning the loading veil. A shader whose whole
 * appearance is a function of depth cannot be judged during a real load, which
 * shows each depth for a fraction of a second.
 */
export function DepthVeilHarness({ depth, onDepthChange, onReplay }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-md bg-white/95 p-2 shadow-md">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
        depth
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={depth}
          onChange={(event) => onDepthChange(Number(event.target.value))}
          className="w-32"
        />
        <span className="w-8 font-mono text-[10px] text-gray-500">
          {depth.toFixed(2)}
        </span>
      </label>
      <button
        type="button"
        onClick={onReplay}
        className="cursor-pointer rounded bg-primary px-2 py-1 text-xs font-medium text-white"
      >
        Replay
      </button>
    </div>
  );
}
```

Add to `features/ship-visualizer/ship-visualizer-config.ts`:

```ts
/** The veil harness is a tuning tool, never product UI. */
export const IS_DEPTH_VEIL_HARNESS_ENABLED =
  process.env.NODE_ENV === "development";
```

- [ ] **Step 4: Mount both behind the dev flag**

In `features/ship-visualizer/ship-visualizer.tsx`, add local state and render the veil inside `<Scene>` plus the harness beside the other overlays. This wiring is temporary — Task 8 replaces `pinnedDepth` with the real phase machine.

```tsx
const [pinnedDepth, setPinnedDepth] = useState(1);
```

Inside `<Scene>`, after `<Ship ... />`:

```tsx
{IS_DEPTH_VEIL_HARNESS_ENABLED && <DepthVeil depth={pinnedDepth} opacity={1} />}
```

Beside `<ModelVariantToggle ... />`:

```tsx
{IS_DEPTH_VEIL_HARNESS_ENABLED && (
  <DepthVeilHarness
    depth={pinnedDepth}
    onDepthChange={setPinnedDepth}
    onReplay={() => setPinnedDepth(1)}
  />
)}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

If TSL's `Fn` argument typing fights the `[ReturnType<typeof float>]` annotations, type the parameter as `[ShaderNodeObject<Node>]` imported from `three/tsl` rather than reaching for `any`.

- [ ] **Step 6: Verify the shader runs on both backends**

1. `http://localhost:3000` — expected: the viewport is covered by a dark blue-green field with a visibly moving caustic web. Drag the depth slider to 0: the field brightens toward `SURFACE_COLOR` and the caustics sharpen. Drag to 1: it goes nearly black and flat.
2. Check the console. Expected: no shader compile errors. A TSL compile failure surfaces as a WGSL or GLSL error mentioning the generated function names.
3. `http://localhost:3000/?forceWebGL` — expected: the same effect. **This is the single most important check in the plan** — it is the proof that one TSL source is serving both backends.
4. Confirm the caustics animate with the slider untouched, which proves the global `time` node is driving them.

- [ ] **Step 7: Commit**

```bash
git add features/3d-scene/lib/depth-veil-shader.ts \
        features/3d-scene/components/depth-veil.tsx \
        features/ship-visualizer/components/depth-veil-harness.tsx \
        features/3d-scene/lib/3d-scene-config.ts \
        features/ship-visualizer/ship-visualizer-config.ts \
        features/ship-visualizer/ship-visualizer.tsx
git commit -m "Add the loading veil quad with a minimal TSL shader and a tuning harness

A fullscreen quad in the existing scene graph, so no second canvas or
renderer is needed now that the scene is node-based. The shader is
deliberately crude at this point — gradient plus caustics — because its
job is to prove one TSL source compiles and runs on both the WebGPU and
WebGL2 backends.

The harness pins depth anywhere in the rise. Without it the shader can
only be seen for the fraction of a second a real load spends at each
depth, which makes the next task's tuning impossible."
```

---

## Task 6: The full shader

Everything here is tuned through the Task 5 harness. Add one `Fn` at a time and look at it before adding the next.

**Files:**
- Modify: `features/3d-scene/lib/depth-veil-shader.ts`

**Interfaces:**
- Consumes: `createDepthVeilMaterial`, `DepthVeilUniforms` (Task 5).
- Produces: same two exports, unchanged signatures. Only the shader body grows.

- [ ] **Step 1: Add god-rays**

Add above `createDepthVeilMaterial`, and the imports it needs (`atan`, `abs`, `sin`, `Loop`, `mx_fractal_noise_float`, `float`):

```ts
const RAY_COUNT = 7;
const RAY_SAMPLES = 4;
const RAY_SOFTNESS = 2.5;
const RAY_NOISE_SCALE = 1.7;
const RAY_DRIFT = 0.05;
const SUN_SCREEN_X = 0.5;

/**
 * Shafts of light fanning from a point above the surface. Angular bands broken
 * up by fractal noise and accumulated over a few samples along the view ray;
 * mx_fractal_noise_float takes a vec3, unlike the Worley call above.
 */
const godRays = Fn(([depthLevel]: [ReturnType<typeof float>]) => {
  const toSun = screenUV.sub(vec2(SUN_SCREEN_X, 1));
  const angle = atan(toSun.x, toSun.y.negate());
  const accumulated = float(0).toVar();

  Loop({ start: 0, end: RAY_SAMPLES }, ({ i }) => {
    const offset = float(i).div(RAY_SAMPLES).mul(0.35);
    const bands = sin(angle.mul(RAY_COUNT).add(offset)).abs();
    const shaped = oneMinus(bands).pow(RAY_SOFTNESS);
    const broken = mx_fractal_noise_float(
      vec3(angle.mul(RAY_NOISE_SCALE), time.mul(RAY_DRIFT), offset),
      3,
      2,
      0.5,
      1
    )
      .mul(0.5)
      .add(0.5);
    accumulated.addAssign(shaped.mul(broken));
  });

  // Rays are strongest just under the surface and vanish in the abyss.
  const reach = oneMinus(depthLevel).pow(1.5);
  return accumulated.div(RAY_SAMPLES).mul(reach);
});
```

Compose it in `createDepthVeilMaterial`, replacing the `colorNode` line:

```ts
const rays = godRays(depth).mul(vec3(SURFACE_COLOR));
material.colorNode = water.add(light).add(rays);
```

Verify in the harness before moving on: at depth 0.3 there should be visible shafts fanning from top-centre; at depth 1.0 they should be gone.

- [ ] **Step 2: Add drifting motes**

```ts
const MOTE_SCALE = 40;
const MOTE_RISE = 0.03;
const MOTE_DENSITY = 0.985;
const MOTE_BRIGHTNESS = 0.35;

/**
 * Sparse particulate drifting upward past the camera. Cheap: one hash per cell,
 * thresholded hard so only a few cells light up.
 */
const motes = Fn(([depthLevel]: [ReturnType<typeof float>]) => {
  const drifted = screenUV.add(vec2(0, time.mul(MOTE_RISE)));
  const cell = drifted.mul(MOTE_SCALE).floor();
  const speck = hash(cell.x.add(cell.y.mul(57)));
  const lit = speck.greaterThan(MOTE_DENSITY).select(float(1), float(0));
  // Denser in the murk, sparse in clear water near the surface.
  return lit.mul(MOTE_BRIGHTNESS).mul(depthLevel.mul(0.7).add(0.3));
});
```

Add `hash` to the imports. Compose:

```ts
const dust = motes(depth).mul(vec3(SURFACE_COLOR));
material.colorNode = water.add(light).add(rays).add(dust);
```

- [ ] **Step 3: Add the hull silhouette**

```ts
const HULL_WIDTH = 0.38;
const HULL_HEIGHT = 0.055;
const HULL_CENTER_X = 0.5;
const HULL_SURFACE_Y = 0.93;
const HULL_BOB_AMPLITUDE = 0.012;
const HULL_BOB_RATE = 0.35;
const HULL_EDGE_SOFTNESS = 0.04;

/**
 * An elongated hull profile occluding the surface light, bobbing gently.
 * Deliberately abstract: the real ship is what is still downloading.
 */
const hullSilhouette = Fn(([depthLevel]: [ReturnType<typeof float>]) => {
  const bob = sin(time.mul(HULL_BOB_RATE)).mul(HULL_BOB_AMPLITUDE);
  const centered = screenUV.sub(vec2(HULL_CENTER_X, HULL_SURFACE_Y + bob));
  // Superellipse: flatter flanks than a true ellipse, so it reads as a hull.
  const profile = centered.x
    .div(HULL_WIDTH)
    .abs()
    .pow(4)
    .add(centered.y.div(HULL_HEIGHT).abs().pow(2));
  const inside = oneMinus(
    smoothstep(1 - HULL_EDGE_SOFTNESS, 1 + HULL_EDGE_SOFTNESS, profile)
  );
  // Only visible once close enough to the surface to be silhouetted against it.
  return inside.mul(oneMinus(depthLevel).pow(0.6));
});
```

Add `smoothstep` to the imports. Compose as an occluder — it *subtracts* light rather than adding colour:

```ts
const shade = oneMinus(hullSilhouette(depth).mul(0.85));
material.colorNode = water.add(light).add(rays).add(dust).mul(shade);
```

- [ ] **Step 4: Add the surface break**

```ts
const SURFACE_FLASH_STRENGTH = 1.6;

/** Exposure lifts as the surface is broken, covering the handoff to the scene. */
const surfaceBreak = Fn(([depthLevel]: [ReturnType<typeof float>]) =>
  oneMinus(smoothstep(0, 0.25, depthLevel)).mul(SURFACE_FLASH_STRENGTH).add(1)
);
```

Final composition:

```ts
material.colorNode = water
  .add(light)
  .add(rays)
  .add(dust)
  .mul(shade)
  .mul(surfaceBreak(depth));
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Verify the whole rise on both backends**

Confirm the file is still under 300 lines (`wc -l features/3d-scene/lib/depth-veil-shader.ts`); if it is over, move the constants into a sibling `depth-veil-constants.ts`.

1. `http://localhost:3000` — sweep the harness slider slowly from 1 to 0. Expected: near-black flat murk with motes → caustics fade in and rays appear → the hull silhouette resolves against brightening water → a bright flash as depth approaches 0.
2. Watch for banding in the gradient and for the rays strobing rather than drifting. Both are tuning problems, not bugs: adjust `RAY_DRIFT` and the gradient colours.
3. `http://localhost:3000/?forceWebGL` — sweep again. Expected: visually equivalent. `Loop` and `hash` are the two constructs most likely to differ between backends, so compare the rays and motes specifically.

- [ ] **Step 7: Commit**

```bash
git add features/3d-scene/lib/depth-veil-shader.ts
git commit -m "Complete the loading veil shader

Adds god-rays, drifting motes, the hull silhouette and the surface-break
exposure lift to the gradient and caustics already in place. Each layer
is its own Fn so it can be tuned or removed on its own.

The silhouette subtracts light rather than adding colour, so it reads as
an occluder against the surface rather than a dark sprite floating in the
water."
```

---

## Task 7: The load-progress phase machine

**Files:**
- Create: `features/ship-visualizer/hooks/use-model-load-progress.ts`

**Interfaces:**
- Consumes: `DEPTH_VEIL_TIMING` (Task 5).
- Produces:

```ts
type DepthVeilPhase = "hidden" | "rising" | "surfacing" | "dissolving";

type ModelLoadProgress = {
  /** False until the veil should mount, and again once it has fully dissolved. */
  isVeilVisible: boolean;
  /** Target for the veil's depth uniform: 1 = abyss, 0 = surface. */
  depth: number;
  /** Target for the veil's opacity uniform. */
  opacity: number;
  phase: DepthVeilPhase;
};

function useModelLoadProgress(isModelReady: boolean): ModelLoadProgress;
```

- [ ] **Step 1: Write the hook**

Create `features/ship-visualizer/hooks/use-model-load-progress.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { DEPTH_VEIL_TIMING } from "@/features/3d-scene/lib/3d-scene-config";

export type DepthVeilPhase = "hidden" | "rising" | "surfacing" | "dissolving";

export type ModelLoadProgress = {
  isVeilVisible: boolean;
  depth: number;
  opacity: number;
  phase: DepthVeilPhase;
};

/** Percent complete, as drei reports it. */
const COMPLETE_PERCENT = 100;

/**
 * Turns the loader's noisy progress into the veil's two targets.
 *
 * `useProgress` reads DefaultLoadingManager, whose `total` grows as the GLB and
 * then each embedded texture is discovered — so raw progress jumps backwards and
 * briefly reports completion between items. It is used only to *position* the
 * rise, clamped monotonic. Completion comes from `isModelReady`, which the
 * visualizer derives from its own tree callback, after parse and post-processing.
 */
export function useModelLoadProgress(isModelReady: boolean): ModelLoadProgress {
  // drei's useProgress is a zustand bound store, so pass a selector: reading the
  // whole object would re-render on every field, including `item`, which changes
  // once per embedded texture.
  const progress = useProgress((state) => state.progress);
  const [phase, setPhase] = useState<DepthVeilPhase>("hidden");
  const highWaterMark = useRef(0);
  const shownAt = useRef<number | null>(null);

  highWaterMark.current = Math.max(highWaterMark.current, progress);

  // Grace period: a cached model that is ready inside it never shows the veil.
  useEffect(() => {
    if (phase !== "hidden" || isModelReady) return;
    const timer = window.setTimeout(() => {
      shownAt.current = performance.now();
      setPhase("rising");
    }, DEPTH_VEIL_TIMING.SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  // Hold the rise for a minimum time so a fast load still reads as a rise.
  useEffect(() => {
    if (phase !== "rising" || !isModelReady) return;
    const shown = shownAt.current ?? performance.now();
    const remaining = Math.max(
      0,
      DEPTH_VEIL_TIMING.MIN_VISIBLE_MS - (performance.now() - shown)
    );
    const timer = window.setTimeout(() => setPhase("surfacing"), remaining);
    return () => window.clearTimeout(timer);
  }, [phase, isModelReady]);

  useEffect(() => {
    if (phase !== "surfacing") return;
    const timer = window.setTimeout(
      () => setPhase("dissolving"),
      DEPTH_VEIL_TIMING.SURFACE_MS
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "dissolving") return;
    const timer = window.setTimeout(() => {
      shownAt.current = null;
      highWaterMark.current = 0;
      setPhase("hidden");
    }, DEPTH_VEIL_TIMING.DISSOLVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // A new load (model switch) re-arms the machine.
  useEffect(() => {
    if (isModelReady) return;
    highWaterMark.current = 0;
    shownAt.current = null;
  }, [isModelReady]);

  const isRising = phase === "rising";
  const isVeilVisible = phase !== "hidden";
  const depth = isRising ? 1 - highWaterMark.current / COMPLETE_PERCENT : 0;

  return {
    isVeilVisible,
    depth,
    opacity: phase === "dissolving" ? 0 : 1,
    phase,
  };
}
```

Note what this hook deliberately does *not* do: it never reads
`useProgress().errors`. A failed model load throws out of `useGLTF` during
render, and because Task 8 places the veil inside `<Scene>`, which is already
inside `ship-visualizer.tsx`'s outer `SceneErrorFallback`, that boundary replaces
the whole viewport — veil included. Load failure is handled structurally, so
polling `errors` would be a second, redundant path that could disagree with the
first.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add features/ship-visualizer/hooks/use-model-load-progress.ts
git commit -m "Add the loading veil phase machine

useProgress cannot be trusted for completion: DefaultLoadingManager's
total grows as embedded textures are discovered, so progress jumps
backwards and briefly reads 100% between items. It positions the rise
here, clamped monotonic, while completion comes from the visualizer's own
tree callback.

A 120ms grace period means a cached model never flashes the veil, and a
700ms floor means a fast one still plays a coherent rise."
```

---

## Task 8: Wire the veil to real loading and remove the grey box

**Files:**
- Modify: `features/ship-visualizer/ship-visualizer.tsx`
- Modify: `features/ship-visualizer/components/scene-content.tsx:250-269`

**Interfaces:**
- Consumes: `useModelLoadProgress` (Task 7), `DepthVeil` (Task 5), `DepthVeilHarness` (Task 5), `SceneErrorFallback` (existing).
- Produces: no new exports.

- [ ] **Step 1: Replace the temporary harness wiring with the real hook**

In `features/ship-visualizer/ship-visualizer.tsx`, `modelTree === null` is already the loading signal — it is what `isLoading` is derived from in two places. Add:

```tsx
const isModelReady = modelTree !== null;
const veil = useModelLoadProgress(isModelReady);
const [pinnedDepth, setPinnedDepth] = useState<number | null>(null);
```

`pinnedDepth` is now nullable: `null` means "follow the real load", a number means the harness has taken over. Replace the Task 5 veil line inside `<Scene>` with:

```tsx
{(veil.isVeilVisible || pinnedDepth !== null) && (
  <SceneErrorFallback fallback={null}>
    <DepthVeil
      depth={pinnedDepth ?? veil.depth}
      opacity={pinnedDepth !== null ? 1 : veil.opacity}
    />
  </SceneErrorFallback>
)}
```

The error boundary is deliberate: a decorative overlay must never be able to break the scene it decorates. Worst case is an ordinary load with no animation.

Replace the harness block with:

```tsx
{IS_DEPTH_VEIL_HARNESS_ENABLED && (
  <DepthVeilHarness
    depth={pinnedDepth ?? veil.depth}
    onDepthChange={setPinnedDepth}
    onReplay={() => setPinnedDepth(null)}
  />
)}
```

- [ ] **Step 2: Delete the grey box**

In `features/ship-visualizer/components/scene-content.tsx`, the `<Suspense>` fallback is a placeholder mesh that the veil now covers completely. Replace:

```tsx
<Suspense fallback={null}>
```

Delete nothing else — `ShipModel` and its props stay exactly as they are.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify a real load, both backends**

1. Hard-reload `http://localhost:3000` with DevTools open and the network throttled to "Fast 3G", so the 24 MB GLB takes long enough to watch. Expected: the veil appears, rises as the download progresses, breaks the surface when the model is ready, and dissolves into the live scene. No grey box at any point.
2. Expected and accepted: a hitch during the final GLB parse, which is main-thread and blocks all rendering. Do not try to fix it — the spec records it as an accepted limitation.
3. Reload with throttling off, twice in a row. Expected: on the warm second load the veil either does not appear at all or plays briefly and cleanly — no single-frame flash of caustics.
4. Switch model variants with the dev toggle (V1 ↔ Optimized). Expected: the veil plays for each switch, and the camera does not move.
5. `http://localhost:3000/?forceWebGL` — repeat step 1.
6. Check the console for errors across all of the above.

- [ ] **Step 5: Commit**

```bash
git add features/ship-visualizer/ship-visualizer.tsx \
        features/ship-visualizer/components/scene-content.tsx
git commit -m "Drive the loading veil from real model load progress

The veil now covers the whole load, so the grey placeholder box behind it
is removed. It is wrapped in SceneErrorFallback with a null fallback: a
decorative overlay must never be able to break the scene it decorates.

The harness pin becomes nullable, so it can either follow the real load
or take over for tuning without a second code path."
```

---

## Task 9: Cross-backend verification and the timing pass

The tuning task. Nothing new is built; the numbers get settled by watching them.

**Files:**
- Modify: `features/3d-scene/lib/3d-scene-config.ts` (timing values)
- Modify: `features/3d-scene/lib/depth-veil-shader.ts` (colour and layer tuning)

**Interfaces:**
- Consumes: everything above.
- Produces: no signature changes.

- [ ] **Step 1: Judge the four timings against a real throttled load**

The values in `DEPTH_VEIL_TIMING` are reasoned starting points, not measurements. With the network throttled, watch a full cycle and check each:

- `SHOW_DELAY_MS` (120) — too low and a warm load flashes; too high and a slow load starts late.
- `MIN_VISIBLE_MS` (700) — too low and a fast load looks like a glitch; too high and it delays a scene that is ready.
- `SURFACE_MS` (500) — the break should feel like emerging, not like a cut.
- `DISSOLVE_MS` (800) — the flash should still be fading as the scene appears. If the seam is visible, this is too short.

- [ ] **Step 2: Tune the shader through the harness**

Sweep the slider and settle: gradient colours (remember they are tone-mapped at exposure 0.3, so they read darker than authored), `CAUSTIC_SHARPNESS`, `RAY_COUNT`/`RAY_DRIFT`, `MOTE_DENSITY`, and the hull's `HULL_WIDTH`/`HULL_HEIGHT` proportions.

- [ ] **Step 3: Full cross-backend pass**

Run every check below on both `http://localhost:3000` and `http://localhost:3000/?forceWebGL`, confirming the badge reads the expected backend each time:

- Throttled cold load: veil rises, surfaces, dissolves.
- Warm reload: no flash.
- Sky drifts; water animates and reflects.
- Hover and selection dim correctly; Escape restores fully with nothing left translucent.
- Both model variants load.
- Zoom, orbit, pan, and the selection details modal all work.
- Console clean of errors in all of the above.

- [ ] **Step 4: Confirm the production build compiles**

Run: `npm run build`
Expected: build succeeds. This is the first check that `three/webgpu` and `three/tsl` bundle correctly under Next 16's production compiler, which is stricter than the dev server — a dev-only success would be a false pass.

- [ ] **Step 5: Commit**

```bash
git add features/3d-scene/lib/3d-scene-config.ts \
        features/3d-scene/lib/depth-veil-shader.ts
git commit -m "Tune the loading veil timings and shader

Settles the four timing values and the layer constants by watching a
throttled load rather than reasoning about them, and confirms the whole
scene on both the WebGPU and WebGL2 backends."
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: the renderer factory and `?forceWebGL` (Task 1), `SkyMesh` and the `PMREMGenerator` import (Task 2), `WaterMesh` (Task 3), the `needsUpdate` guard (Task 4), the quad placement, the two uniforms and the dev harness (Task 5), the five shader `Fn` blocks and the surface break (Task 6), the four-phase machine and the `useProgress`/`modelTree` split (Task 7), the grey-box removal and the veil error boundary (Task 8), parity verification and the accepted parse hitch (Tasks 3 and 9). The spec's "only two symbols need `three/webgpu`" finding is carried in Global Constraints. Its two out-of-scope items (test runner, TSL post-processing) appear nowhere, as intended.

**Placeholder scan.** No TBD/TODO, no "add error handling", no "similar to Task N". Every code step carries the actual code. Task 6's tuning steps name the specific constants to adjust rather than saying "tune it".

**Type consistency.** `createDepthVeilMaterial` returns `{ material, uniforms }` in Task 5 and is consumed with those names in Task 6. `DepthVeil`'s props are `{ depth, opacity }` in Task 5 and passed as those in Task 8. `useModelLoadProgress(isModelReady)` returns `{ isVeilVisible, depth, opacity, phase }` in Task 7 and Task 8 reads exactly those. `isWebGPUBackend` is defined in Task 1 and used only by Task 1's probe. `DEPTH_VEIL_TIMING`'s five keys are defined in Task 5 and read by Tasks 5, 7 and 9 under the same names.

**One deviation from the skill, stated plainly:** the skill's TDD cycle ("write the failing test, run it, make it pass") is not followed, because this repo has no test runner and the spec puts adding one out of scope. Each task instead ends with a typecheck and a specific, falsifiable browser observation — including what a failure would look like, so a step can genuinely fail rather than being rubber-stamped.
