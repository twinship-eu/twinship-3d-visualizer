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
  /** Captured console.error and console.warn lines, oldest first. */
  lines: string[];
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
  lines: [],
};

/** Whether `?diag` is present. SSR-safe: this module loads on the server too. */
export function isDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(DIAGNOSTICS_PARAM);
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
}
