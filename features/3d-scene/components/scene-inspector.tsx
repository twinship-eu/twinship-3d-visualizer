"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  getSceneInspector,
  IS_SCENE_INSPECTOR_ENABLED,
} from "../lib/webgpu-renderer";
import type {
  LoadingRingOverride,
  LoadingRingUniforms,
} from "../lib/loading-ring-particles";

/** Slider ranges for the ring's visual uniforms, as [min, max, step]. */
const RING_SLIDERS: Record<string, readonly [number, number, number]> = {
  waterline: [-12, 6, 0.5],
  radius: [5, 120, 1],
  tilt: [0, Math.PI / 2, 0.01],
  spinSpeed: [-2, 2, 0.01],
  spriteSize: [0.05, 4, 0.05],
  glow: [0, 6, 0.05],
  arcSoftness: [0.005, 0.4, 0.005],
  bandThickness: [0, 0.3, 0.005],
} as const;

/**
 * Uniforms the ring writes every frame from its phase clock. They are not
 * sliders: anything bound to them would be overwritten before it was seen.
 * `progress` and `dispersion` are reachable through the override's pin instead.
 */
type TunableUniform = Exclude<
  keyof LoadingRingUniforms,
  "progress" | "dispersion" | "assembly" | "fade"
>;

export type LoadingRingControls = {
  uniforms: LoadingRingUniforms;
  override: LoadingRingOverride;
};

type Props = {
  ringControls: LoadingRingControls | null;
};

/**
 * Registers the loading ring's tunables in three's built-in Inspector.
 *
 * The Inspector itself is attached in `createSceneRenderer`, because the
 * renderer calls `inspector.init()` from inside its own `init()` and the
 * `inspector` setter does not re-run it — attaching afterwards leaves the panel
 * permanently detached. Alongside these controls it brings its own Performance
 * and Console tabs, which is the real reason to prefer it over a plain GUI after
 * moving the scene to WebGPU.
 *
 * Every visual tunable is a uniform precisely so it can be bound here: `add`
 * writes to `uniform.value` directly, so a slider changes the shader with no
 * rebuild and no React involvement. Only the particle count is fixed, since it
 * is baked into the geometry.
 *
 * `progress` and `dispersion` bind to the override rather than their uniforms,
 * because the ring overwrites those every frame. Use `loop` to replay the whole
 * cycle continuously, or `pin` to freeze it at one point.
 */
export function SceneInspector({ ringControls }: Props) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED || ringControls === null) return;

    const inspector = getSceneInspector(gl);
    if (inspector === null) return;

    const { uniforms, override } = ringControls;
    const group = inspector.createParameters("Loading ring");

    group.add(override, "isLooping").name("loop (replay forever)");
    group.add(override, "isPinned").name("pin (freeze)");
    group.add(override, "progress", 0, 1, 0.01).listen();
    group.add(override, "assembly", 0, 1, 0.01).listen();
    group.add(override, "fade", 0, 1, 0.01).listen();
    group.add(override, "dispersion", 0, 1, 0.01).listen();

    // Each stage has its own duration rather than a share of one total, so the
    // converge can be tuned without shortening the fill.
    const timing = group.addFolder("Timing (seconds)");
    timing.add(override, "fillSeconds", 0.5, 10, 0.25).name("fill (one loop)");
    timing.add(override, "convergeSeconds", 0.1, 6, 0.1).name("converge");
    timing.add(override, "holdSeconds", 0, 4, 0.1).name("hold ghost");
    timing.add(override, "revealSeconds", 0.1, 6, 0.1).name("reveal ship");

    const shape = group.addFolder("Shape & motion");
    for (const [name, [min, max, step]] of Object.entries(RING_SLIDERS)) {
      shape.add(uniforms[name as TunableUniform], "value", min, max, step).name(name);
    }
  }, [gl, ringControls]);

  return null;
}
