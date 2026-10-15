/**
 * The TwinShip Bridge cockpit: the app's shell around the 3D view — its top
 * bar, the two viewer modes, the themes. Layout from the design's 1440 × 900
 * screens.
 */

/** The two things the viewer shows: the static ontology, or the ship's live data. */
export const VIEWER_MODES = ["ontology", "live"] as const;
export type ViewerMode = (typeof VIEWER_MODES)[number];
/** The mode the app opens in. */
export const DEFAULT_VIEWER_MODE: ViewerMode = "ontology";
/** The URL parameter the mode is kept in, so a link opens the same view. */
export const VIEWER_MODE_PARAM = "view";

/** Themes: dark by default, as on a bridge at night. */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";
/** Where the viewer's chosen theme is remembered, per browser. */
export const THEME_STORAGE_KEY = "twinship-theme";

/** Who and what the top bar names. */
export const COCKPIT_BRAND = {
  title: "TWINSHIP BRIDGE",
  subtitle: "Knud E. Hansen · TwinShip VESSEL",
  ontologyCaption: "Static 3D model · component structure and specifications",
} as const;

/**
 * Sets the theme on <html> before the first paint, from what the viewer chose
 * last: run inline in <head>, so a light page never flashes dark first.
 * Kept a plain string: it runs before any bundle has loaded.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

/** Inside Live data: the ship's systems, or its voyage. */
export const LIVE_VIEWS = ["systems", "voyage"] as const;
export type LiveView = (typeof LIVE_VIEWS)[number];
export const DEFAULT_LIVE_VIEW: LiveView = "systems";
export const LIVE_VIEW_PARAM = "live";
/** Whether the Systems view shows its callouts over the scene (`?callouts=false` for a clean view). */
export const CALLOUTS_PARAM = "callouts";
/** Whether the Live view shows its navigation layer in the bar under the ship (`?nav=false` to hide it). */
export const NAVIGATION_PARAM = "nav";
/**
 * The SHOW bar's Navigation toggle. Off: the navigation layer always shows —
 * the heading at the top, the attitude top right, wind and route in the bar —
 * and the ship is stopped from the zoom controls' anchor button instead.
 */
export const IS_NAVIGATION_TOGGLE_ENABLED = false;
/**
 * Live data as one view (the design's "Live view"): the components and the
 * navigation as two layers over one ship, no Systems/Voyage split. Off brings
 * the two views back.
 */
export const IS_SINGLE_LIVE_VIEW_ENABLED = true;
/** The bridge camera: "optional, for later" in the design. Kept, flagged off. */
export const IS_BRIDGE_VIEW_ENABLED = false;

/**
 * What each level of autonomy the ship reports means, for the top bar's
 * badge. A working reading of the L0–L4 scale, in the spirit of IMO's degrees
 * of autonomy for MASS, until the ontology defines it (`draft_time_mode.ttl`).
 */
export const AUTONOMY_LEVELS: Record<string, string> = {
  L0: "Manual: the crew steers and runs the ship",
  L1: "Decision support: the systems advise, the crew decides and acts",
  L2: "Partial autonomy: the systems act on some functions, the crew supervises throughout",
  L3: "Conditional autonomy: the ship sails itself; the crew or the shore centre monitors and takes over when asked",
  L4: "High autonomy: the ship sails itself for the whole leg; people are on call",
};

/** The panels Live data can open beside or over the scene: the event log, the ship assistant. */
export const COCKPIT_PANELS = ["log", "assistant"] as const;
export type CockpitPanel = (typeof COCKPIT_PANELS)[number];
export const PANEL_PARAM = "panel";
/** The event log's system filter, by the tree section's id. */
export const LOG_SYSTEM_PARAM = "logSystem";

/** The phone's four places, as the design has them: the live view, the components, the event log, the assistant. */
export const MOBILE_TABS = ["live", "components", "log", "ask"] as const;
/** The phone's tab, in the URL: the live view, the default, leaves it clean. */
export const MOBILE_TAB_PARAM = "tab";
