"use client";

import { useSyncExternalStore } from "react";

/**
 * On-screen diagnostics for devices whose console cannot be reached.
 *
 * Remote debugging an Android handset needs USB authentication that does not
 * always come up, and a deployed build cannot be inspected from a terminal at
 * all. This captures what a console would have shown and puts it on the page,
 * so a photograph of the screen carries the same evidence.
 *
 * Opt-in through `?diag`, not through NODE_ENV: the whole point is to run it
 * against a production deployment. It is inert without the query param.
 */


/** Query param that switches the overlay on. */
const DIAGNOSTICS_PARAM = "diag";

/** Most captured console lines to keep; the earliest ones matter most. */
const MAX_CAPTURED_LINES = 12;

/** Longest single captured line, so one huge stack cannot fill the screen. */
const MAX_LINE_LENGTH = 220;

export type SceneDiagnostics = {
  /** Which backend the renderer actually resolved to. */
  backend: string;
  /** Whether the IBL probe was assigned. Metallic materials render black without it. */
  hasEnvironment: string;
  /** Whether shadows ended up enabled, after React Three Fiber applies its prop. */
  shadowsEnabled: string;
  /** Whether the backend admits to supporting depth-texture comparison. */
  depthCompare: string;
  /** Renderer pixel size, to catch a zero-sized canvas. */
  drawingBufferSize: string;
  /** scene.environmentIntensity; a probe at zero lights metal no better than none. */
  environmentIntensity: string;
  /** Whether the probe's texture reports usable dimensions. */
  environmentSize: string;
  /** Tone mapping and exposure, which scale the whole image. */
  toneMapping: string;
  /** Per-material readout for the ship: the surfaces that render black. */
  materials: string[];
  /** Meshes in the scene, so an empty stage is not mistaken for a broken one. */
  meshCount: string;
  /** Captured console.error and console.warn lines, oldest first. */
  lines: string[];
  /**
   * Every error and warning seen, including those past MAX_CAPTURED_LINES.
   *
   * Reported separately so a small `lines` count cannot be misread as a quiet
   * console: "3 of 3" and "12 of 400" look very different and mean very
   * different things.
   */
  totalCaptured: number;
};

/**
 * Live diagnostics, written by the probe and read by the overlay.
 *
 * A shared mutable for the same reason as SCENE_STATS: it is written from
 * inside the Canvas and read outside it, and must not re-render the tree.
 */
export const SCENE_DIAGNOSTICS: SceneDiagnostics = {
  backend: "…",
  hasEnvironment: "…",
  shadowsEnabled: "…",
  depthCompare: "…",
  drawingBufferSize: "…",
  environmentIntensity: "…",
  environmentSize: "…",
  toneMapping: "…",
  materials: [],
  meshCount: "…",
  lines: [],
  totalCaptured: 0,
};

/**
 * Whether `?diag` is present.
 *
 * Returns false during server rendering, which is why callers must not branch
 * on it during the first client render either: the server would emit no
 * overlay, the client would emit one, and React reports the difference as a
 * hydration failure (minified error #418). `useIsDiagnosticsEnabled` below
 * exists to make that hard to get wrong.
 */
export function isDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(DIAGNOSTICS_PARAM);
}

/** The query string never changes without a reload, so nothing to subscribe to. */
const subscribeToNothing = () => () => {};

/** What the server renders: no overlay, whatever the URL says. */
const getServerSnapshot = () => false;

/**
 * The same answer, but safe to branch on during render.
 *
 * useSyncExternalStore is built for precisely this: a value that legitimately
 * differs between server and client. It takes the server's answer during
 * hydration and the client's immediately after, so the two trees never
 * disagree and React raises no hydration error. Reading the query string
 * directly in render instead is what produced minified error #418.
 *
 * Use this in components; the plain function above is for non-render code.
 */
export function useIsDiagnosticsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    isDiagnosticsEnabled,
    getServerSnapshot
  );
}

let isCaptureInstalled = false;

function record(level: string, args: unknown[]): void {
  const text = args
    .map((arg) => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");

  SCENE_DIAGNOSTICS.totalCaptured += 1;

  const line = `${level}: ${text}`.slice(0, MAX_LINE_LENGTH);
  // Keeps the EARLIEST lines. A cascade of follow-on errors is noise; the first
  // message is the one that explains the rest.
  if (SCENE_DIAGNOSTICS.lines.length < MAX_CAPTURED_LINES) {
    SCENE_DIAGNOSTICS.lines.push(line);
  }
}

/**
 * Starts copying console errors and warnings into SCENE_DIAGNOSTICS.
 *
 * Wraps rather than replaces, so everything still reaches the real console for
 * anyone who can read it. Installed once, and only with `?diag` present.
 */
export function installConsoleCapture(): void {
  if (isCaptureInstalled || !isDiagnosticsEnabled()) return;
  isCaptureInstalled = true;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    record("ERR", args);
    originalError.apply(console, args as []);
  };
  console.warn = (...args: unknown[]) => {
    record("WARN", args);
    originalWarn.apply(console, args as []);
  };

  window.addEventListener("unhandledrejection", (event) => {
    record("REJECT", [event.reason]);
  });

  // Uncaught exceptions never reach console.error's wrapper, and a WebGPU
  // device loss arrives this way rather than as a logged message.
  window.addEventListener("error", (event) => {
    record("UNCAUGHT", [event.message]);
  });
}
