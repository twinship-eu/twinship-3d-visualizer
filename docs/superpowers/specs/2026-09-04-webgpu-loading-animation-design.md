# WebGPU migration and TSL loading animation

**Date:** 2026-09-04
**Status:** Phase 1 implemented as designed. **Phase 2 superseded** — see
"Phase 2 superseded" below.
**Branch base:** `model-v2-update` @ `e72d4f6`

## Phase 2 superseded

The renderer migration (Phase 1) shipped exactly as designed and is unchanged.

Phase 2's fullscreen "surfacing from the depths" veil was built, reviewed and
**rejected**: an opaque quad covering the viewport hides the sky, the ocean and
the reflections, which is the wrong trade for a scene whose whole appeal is that
it is a scene. The design offered a choice between covering the viewport and
covering the page, and never offered the option that was actually wanted —
leaving the scene visible and putting the loader *inside* it.

It was replaced by an in-scene particle ring: a tilted circle of instanced
sprites at the waterline, with a bright arc fixed in world space that grows with
load progress, bursting outward as the ship appears. The scene behind it is
untouched and the water reflects it.

What carried over unchanged: the phase machine and its `useProgress`-positions /
`modelTree`-completes split, the monotonic clamp, the grace period and minimum
visible floor, the React-owns-phases / `useFrame`-owns-frames rule, and handling
load failure structurally through the existing error boundary. What did not: the
veil shader, the fullscreen quad, and the depth/opacity uniform pair.

Two facts found during that work are worth keeping, because both are invisible
until a pipeline fails:

- `pointUV` generates the literal GLSL `gl_PointCoord`, so it cannot compile
  under WGSL and invalidates the entire render pipeline on WebGPU. Rounding off
  particles therefore requires instanced quads with a real `uv` attribute, not
  `Points`.
- three's Inspector must be assigned **before** `renderer.init()`. The renderer
  calls `inspector.init()` from inside its own `init()`, and the `inspector`
  setter does not re-run it, so a later assignment leaves the panel silently
  detached.

## Goal

Replace the ship visualizer's loading placeholder — currently a grey box mesh in
`scene-content.tsx`'s Suspense fallback — with a "surfacing from the depths"
animation authored in TSL: caustic light, god-rays and a hull silhouette seen
from underwater, rising as the model downloads and dissolving into the live scene
when it is ready.

TSL requires the node-material pipeline, so this means migrating the scene from
`WebGLRenderer` to `WebGPURenderer`. That migration is the larger half of the
work and lands first, on its own, with no intended visual change.

## Constraints

- **WebGL fallback is required.** Devices without WebGPU must keep working.
- **Visual parity for sky and water.** Nobody should be able to tell the
  migration happened.
- **WebGPU best practices**, specifically: no per-frame pipeline invalidation.
- The animation covers the 3D viewport only. The ontology panel keeps its
  existing `isLoading` skeleton.

## Why the fallback needs no forked code

three 0.183 ships TSL-native replacements for the only two WebGL-only objects in
the scene:

| Current | Replacement | Notes |
| --- | --- | --- |
| `examples/jsm/objects/Sky.js` | `SkyMesh.js` | Already carries `cloudCoverage`, `cloudDensity`, `cloudElevation`, and adds `cloudScale`/`cloudSpeed` |
| `examples/jsm/objects/Water.js` | `WaterMesh.js` | Same options as uniform properties |

Both are node-based, so one TSL source compiles to WGSL on the WebGPU backend
and GLSL on the WebGL2 backend. `WebGPURenderer` selects the backend itself
based on whether `navigator.gpu` resolves an adapter.

Everything else already works: `PMREMGenerator` is exported from `three/webgpu`,
GLTF `MeshStandardMaterial`s are auto-converted to node materials, and
`OrbitControls` is DOM-based.

`GLProps` in `@react-three/fiber` 9.5 includes
`(defaultProps: DefaultGLProps) => Promise<Renderer>`, so the async renderer
factory `WebGPURenderer` needs for `await renderer.init()` is a first-class
supported path.

## Phase 1 — Renderer migration

Acceptance: sky and water read the same as before, nothing new in the console,
and no new features. Independently shippable.

### New: `features/3d-scene/lib/webgpu-renderer.ts`

One factory, so the renderer decision lives in one place:

```ts
export async function createSceneRenderer(props: DefaultGLProps) {
  const renderer = new WebGPURenderer({
    canvas: props.canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    forceWebGL: shouldForceWebGL(),
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  await renderer.init();
  return renderer;
}
```

`shouldForceWebGL()` returns true only for an explicit `?forceWebGL` query
param, guarded by `typeof window !== "undefined"` since this is a Next app and
the module is imported during SSR. There is no capability branch in our own code
— the escape hatch exists so a WebGPU-capable machine can reproduce fallback
bugs.

On failure the factory retries once with `forceWebGL: true`; if that also fails
it throws a named error rather than logging and leaving a dead canvas.

### Only two symbols actually need `three/webgpu`

`three.module.js` and `three.webgpu.js` both re-export from the same
`three.core.js`, so `Mesh`, `PlaneGeometry`, `Group`, `Object3D`, `Vector3` and
friends are **the same class objects** through either entry point. There is no
dual-identity hazard and no sweeping import rewrite: every existing
`import { Group } from "three"` stays exactly as it is.

Only genuinely renderer-specific classes differ, and we use two:
`WebGPURenderer` and `PMREMGenerator`.

This also means **no `extend()` call and no `ThreeElements` module
augmentation.** R3F's default catalogue is built from `three`, and since the core
classes are shared it already drives the WebGPU renderer correctly. `extend()`
would only be needed to write node materials as JSX tags — which we avoid by
building the veil's material in `createDepthVeilMaterial()` and attaching it with
`<primitive object={material} attach="material" />`.

### Changed files

- **`features/3d-scene/3d-scene.tsx`** — `gl={createSceneRenderer}`.
  `outputBufferType` is dropped (not a `WebGPURenderer` parameter; MSAA is
  `antialias`/`samples`). Its `ACESFilmicToneMapping` and `PCFShadowMap` imports
  move into `webgpu-renderer.ts` along with the renderer configuration.
- **`features/3d-scene/components/scene-sky.tsx`** — `Sky` → `SkyMesh`; uniform
  access moves from `material.uniforms.x.value` to `mesh.x.value`; the `useFrame`
  time advance is **deleted** in favour of the built-in `cloudSpeed`, which
  drives itself from TSL's global `time` node.
- **`features/3d-scene/components/scene-water.tsx`** — `Water` → `WaterMesh`;
  options become uniform properties; its `useFrame` time advance is likewise
  deleted (`WaterMesh` reads global `time` directly).
- **`features/3d-scene/lib/3d-scene-config.ts`** — `SKY_UNIFORMS` gains
  `cloudScale` and `cloudSpeed`.
- **`features/3d-scene/components/scene-environment-map.tsx`** — import moves to
  `three/webgpu`. `createSky()` keeps its second job of feeding the IBL bake.
- **`features/ship-visualizer/lib/3d-model.ts`** — guard
  `material.needsUpdate = true` in the opacity and highlight paths (lines 318 and
  360) so it fires only when `transparent` actually flips:

  ```ts
  if (mat.transparent !== targetTransparent) mat.needsUpdate = true;
  ```

  It cannot be removed outright: `transparent` and `depthWrite` change alongside
  `opacity` here, and a blend-state change does need the material revalidated.
  But `transparent` flips only between dimmed and undimmed, whereas `opacity`
  changes on every hover — so the guard eliminates nearly every recompile while
  staying correct. Under `WebGLRenderer` an unguarded write is a cheap
  re-upload; under WebGPU it invalidates the render pipeline and forces a shader
  recompile on every hover. Correct for both renderers, so this is a fix either
  way rather than a WebGPU concession.

### Verification

Fixed-camera before/after screenshots on both backends (`?forceWebGL` supplies
the second), and a `renderer.backend.isWebGPUBackend` readout so it is visible
which path a device took.

## Phase 2 — The loading animation

### Placement

Because the scene is node-based after phase 1, the animation needs no second
canvas and no second renderer. It is a fullscreen quad in the existing scene
graph: a 2×2 plane whose `vertexNode` is `vec4(positionGeometry.xy, 0, 1)`, so it
covers the viewport independent of the camera, with `depthTest` and `depthWrite`
off, `frustumCulled: false`, a high `renderOrder` and `transparent: true`.

`use-model-load-progress.ts` is called in `ship-visualizer.tsx`, which already
owns `modelTree`. `<DepthVeil>` is rendered there as a sibling of `<Ship>` inside
`<Scene>` — it must be inside the `<Canvas>` to be in the scene graph — and
`ship-visualizer.tsx` stops rendering it when the hook reports the dissolve is
complete.

**The grey box goes away.** `scene-content.tsx`'s Suspense fallback (currently a
`boxGeometry` with `meshStandardMaterial color="gray"`) becomes `null`: the veil
covers the viewport for the whole load, so a placeholder mesh behind it is dead
weight.

### New files

**`features/3d-scene/lib/depth-veil-shader.ts`** — pure TSL. No React, no scene
objects. Exports `createDepthVeilMaterial(): { material, uniforms }`. Tuning
constants live at the top of this file; nothing else reads them.

**`features/3d-scene/components/depth-veil.tsx`** — the R3F component. Owns the
quad and per-frame uniform writes.

**`features/ship-visualizer/hooks/use-model-load-progress.ts`** — behaviour hook
(hence `hooks/`, not `queries/` — nothing is fetched). Turns drei's raw
`useProgress` into the veil's phase and progress.

### Shader composition

Five `Fn()` blocks, each independently tweakable, composited back to front:

1. `abyssGradient(depth)` — vertical ramp, near-black below to blue-green at the
   surface. `depth` re-maps the ramp, which is what makes rising read as rising.
2. `caustics(uv, depth)` — two counter-scrolling `mx_worley_noise_float` layers,
   differenced and raised to a power for the sharp bright web. Contrast scales
   with `oneMinus(depth)`: barely present in the abyss, near-blinding at the
   surface.
3. `godRays(uv, depth)` — angular bands from a sun point above, broken up by
   `mx_fractal_noise_float`, accumulated over a short `Loop`, length attenuated
   by depth.
4. `motes(uv, depth)` — `hash`-based particulate drifting past, for parallax and
   a sense of moving upward.
5. `hullSilhouette(uv, depth)` — an analytic elongated hull profile occluding the
   surface light, bobbing on `time`. Deliberately abstract; the real ship is what
   is still downloading.

A `surfaceBreak` term then lifts exposure as `depth → 0`. Caustic highlights
borrow `SELECTED_PART_COLOR` (`#7f56d9`) so the effect reads as this product's
ocean rather than a generic one.

All primitives confirmed present in `three/tsl` at 0.183: `mx_worley_noise_float`,
`mx_fractal_noise_float`, `hash`, `time`, `screenUV`, `screenSize`, `Loop`,
`oneMinus`, `remap`.

### Uniforms

Exactly two: `depth` and `opacity`. Everything else is `time`, `screenUV` or
`screenSize`, all renderer-provided. Two scalar writes per frame, zero material
invalidation — the same best-practice point as phase 1's `needsUpdate` fix.

### Progress and phases

`useProgress` reads `DefaultLoadingManager`, whose `total` grows as items (the
GLB, then each embedded texture) are discovered, so raw progress jumps backwards
and `active` briefly reports completion between items. The app already has a
truthful ready signal: `onModelTreeLoaded` firing, i.e. `modelTree !== null` in
`ship-visualizer.tsx`, after parse *and* post-processing.

So the roles split: **`useProgress` positions the rise, `modelTree` ends it.**
Progress is clamped monotonic so a growing `total` can never drag it back down.

Four phases, owned by `use-model-load-progress.ts`:

| Phase | Entered when | Behaviour |
| --- | --- | --- |
| `hidden` | load starts | The first `SHOW_DELAY_MS` (120ms), during which `ship-visualizer.tsx` renders no veil at all. If the model is ready inside this window the veil is never mounted, so a warm load shows no flash of caustics. |
| `rising` | delay elapsed, still loading | `depth` tracks `1 - progress`. |
| `surfacing` | `modelTree !== null` **and** `MIN_VISIBLE_MS` (700ms) elapsed | `depth` eases to 0 over `SURFACE_MS` (500ms): breaking the surface. |
| `dissolving` | surface reached | `opacity` 1 → 0 over `DISSOLVE_MS` (800ms), overlapping the surface flash so the brightness spike covers the handoff. Parent then unmounts the veil, releasing the quad and its pipeline. |

`DEPTH_VEIL_TIMING` lives in `3d-scene-config.ts`, since both the hook and the
component read it.

**React owns phases, `useFrame` owns frames.** The hook's state changes a handful
of times per load; `depth` and `opacity` are interpolated inside `useFrame` and
written straight to the uniforms. Never `setState` per frame — that would
re-render React 60×/s *during* the load and starve the animation it is driving.
Interpolation is frame-rate independent (`1 - exp(-k·delta)`) so it cannot snap
on a long frame.

**No fake progress.** If the download stalls, `depth` holds. The frame stays
alive because caustics, rays and motes all animate on global `time`, plus a
±0.02 sinusoidal bob on `depth`.

**No timeout.** A veil that gives up reveals an empty ocean, which is worse than
waiting. Genuine failure is handled by `SceneErrorFallback` replacing the scene.

### Consequences worth naming

- Switching variants with the dev toggle re-enters this cycle
  (`setModelTree(null)` on path change) — a free win when loading the 170 MB raw
  model.
- The veil never touches the camera, preserving the variant toggle's
  same-angle comparison.

## Dev harness

Behind the existing `process.env.NODE_ENV === "development"` gate (same pattern
as `IS_MODEL_VARIANT_TOGGLE_ENABLED`):

- a `depth` slider that pins the veil anywhere in the rise and holds it
  indefinitely;
- a replay button for the full rise → surface → dissolve.

This is a deliverable, not a convenience. A shader whose entire appearance is a
function of `depth` cannot be tuned during a load that shows each depth for
200ms.

## Failure handling

| Failure | Handling |
| --- | --- |
| WebGPU init fails | Factory retries once with `forceWebGL: true`, then throws a named error. |
| Model load fails | Handled structurally, with no error polling: `useGLTF` throws during render, and the veil sits inside `<Scene>`, itself inside the existing outer `SceneErrorFallback`, so that boundary replaces the viewport and the veil with it. |
| The veil itself breaks | Wrapped in the existing `SceneErrorFallback` with `fallback={null}`. A decorative overlay must never break the scene it decorates; worst case is an ordinary load with no animation. |

## Accepted limitations

- **GLTF parse is main-thread**, so no frames render during the final parse spike
  and the animation hitches there regardless of shader cost. Accepted: network
  download, the long part for 24 MB, animates smoothly. Fixing it would need a
  worker or OffscreenCanvas, out of scope.
- **XR is unsupported on the WebGPU backend** in three 0.183. The project uses no
  XR, so this costs nothing — recorded only so it is not rediscovered later.

## Out of scope

- Test runner. There is none in this repo (`"lint": "eslint"` is the only check,
  and `eslint-config-prettier` is currently missing from `node_modules`, so lint
  does not run either). Verification is the screenshots and dev harness above.
  Adding a runner is a separate conversation.
- TSL post-processing (bloom, godrays, SSR from `three/examples/jsm/tsl/display/`)
  and refracting the loaded scene through the water surface. Both become
  available after phase 1 and are a deliberate phase-3 option, not part of this
  work.
- Rewriting sky or water beyond parity.
