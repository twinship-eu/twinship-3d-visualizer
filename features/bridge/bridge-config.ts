/**
 * The bridge view: the camera in the control room, looking ahead through its
 * windows, each window a pane of glass showing one system — the head-up
 * display the cockpit design calls "two layers on the glass".
 */

/** The model's control room, whose windows the panes are fitted to, and its label in the tree. */
export const CONTROL_ROOM_OBJECT_NAME = "ControlRoom";
export const CONTROL_ROOM_LABEL = "Control room";

/**
 * Where the eye is in the control room, as shares of its bounding box: across
 * (x), up (y) and along the ship (z, 0 aft) — standing at the consoles, a
 * few metres from the front windows, looking out over the bow: the room is
 * deep, and from its back the windows were a thin band far off.
 */
export const EYE_IN_ROOM = { x: 0.5, y: 0.5, z: 0.68 } as const;

/** The panes across the front windows: how many, and the frames between them, in world units. */
export const PANE_COUNT = 5;
export const PANE_MULLION_WIDTH = 0.14;
/** How far in from the room's front face the glass sits, and how far in from its sides. */
export const PANE_INSET = { front: 0.25, side: 0.35 } as const;
/** The panes' share of the room's height: from the sill to the head. */
export const PANE_HEIGHT_SHARE = { from: 0.1, to: 0.92 } as const;

/** Each pane's HUD texture, in pixels: the pane's own proportions are set from the room. */
export const PANE_TEXTURE_HEIGHT = 512;

/**
 * How bright the HUD's light is on the glass, over white: past 1, the bloom
 * spreads it into a halo round the text — the futuristic glow.
 */
export const HUD_INTENSITY = 3.4;
/** How much the glass itself tints the view, by day, and how much it dims it by night. */
export const GLASS_OPACITY = 0.07;
export const NIGHT_GLASS_OPACITY = 0.72;

/** How far the eye may turn, in degrees: left and right, up and down — inside the room, looking out. */
export const LOOK_LIMITS = { yaw: 76, pitchUp: 14, pitchDown: 24 } as const;
/** Degrees the view turns per CSS pixel dragged. */
export const LOOK_SPEED = 0.18;
/** The field of view the wheel zooms between, degrees; the bridge opens at the widest. */
export const FOV_LIMITS = { narrowest: 26, widest: 56 } as const;
export const FOV_STEP = 4;
/** The scene's own field of view, restored on leaving the bridge. */
export const SCENE_FOV = 45;

/** What the panes show: every system, only those alarmed, or nothing — clear glass. */
export const HUD_MODES = ["full", "alarms", "clear"] as const;
export type HudMode = (typeof HUD_MODES)[number];

/** The systems a pane can show, the design's P1-P5 by default. */
export const PANE_SYSTEMS = ["energy", "wind", "nav", "hull", "propulsion"] as const;
export type PaneSystem = (typeof PANE_SYSTEMS)[number];

export const PANE_SYSTEM_INFO: Record<PaneSystem, { title: string; label: string; componentLabel: string | null }> = {
  energy: { title: "ENERGY", label: "Energy system", componentLabel: "Engine" },
  wind: { title: "WIND", label: "Wind assist", componentLabel: "WAPS" },
  nav: { title: "NAV", label: "Navigation", componentLabel: null },
  hull: { title: "HULL", label: "Hull & stability", componentLabel: "Base Hull" },
  propulsion: { title: "PROPULSION", label: "Propulsion + deck", componentLabel: "Propellers" },
};

/**
 * The HUD's colours, by day and by night: cockpit blue and white by day;
 * by night amber and red, which keep the eye's dark adaptation.
 */
export const HUD_PALETTES = {
  day: { text: "#ffffff", muted: "#c3d3f0", accent: "#7fd6ff", ok: "#6ff0b4", warn: "#ffc454", card: "rgba(14, 26, 52, 0.62)", cardLine: "rgba(170, 205, 255, 0.55)" },
  night: { text: "#ffb088", muted: "#d98a64", accent: "#ff9366", ok: "#ffab66", warn: "#ff6a4a", card: "rgba(24, 8, 4, 0.7)", cardLine: "rgba(255, 140, 100, 0.5)" },
} as const;
export type HudPalette = Record<keyof (typeof HUD_PALETTES)["day"], string>;
