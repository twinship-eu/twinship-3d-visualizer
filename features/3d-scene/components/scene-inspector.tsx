"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Inspector } from "three/examples/jsm/inspector/Inspector.js";
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
 * Puts the Inspector back to just its toggle button, which keeps the FPS
 * readout while giving the viewport back.
 *
 * `createParameters` reveals the parameters tab as a side effect of registering
 * controls, so this hides it again afterwards. Hiding the *tab* rather than
 * toggling the panel matters: the Inspector persists its layout, and a tab the
 * user has detached into a floating window is unaffected by the panel toggle.
 *
 * Neither `profiler` nor `parameters` is in three's type definitions, hence the
 * cast; every access is optional so a change to its internals degrades to "the
 * panel starts open" rather than throwing.
 */
function collapsePanel(inspector: Inspector): void {
  const internals = inspector as unknown as {
    parameters?: { hide?: () => void };
    profiler?: { panel?: HTMLElement; togglePanel?: () => void };
  };

  internals.parameters?.hide?.();

  const { profiler } = internals;
  if (
    profiler?.panel?.classList.contains("visible") === true &&
    typeof profiler.togglePanel === "function"
  ) {
    profiler.togglePanel();
  }
}

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

    collapsePanel(inspector);
  }, [gl, ringControls]);

  return null;
}
