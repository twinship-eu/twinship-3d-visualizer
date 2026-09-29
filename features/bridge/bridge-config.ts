/**
 * The bridge view: the camera in the control room, free to walk and look
 * about in it and out through all its windows; the two front windows carry
 * the head-up display — the cockpit design's "layers on the glass".
 */

/** The model's control room, whose windows turn to glass, and its label in the tree. */
export const CONTROL_ROOM_OBJECT_NAME = "ControlRoom";
export const CONTROL_ROOM_LABEL = "Control room";

/**
 * The room's windows: the centres of their triangles, in its mesh's own
 * space, found by their glass in its texture (the lighter blue) — 26 windows
 * of two triangles: the front row, the wings, the sides and the back. By
 * position, not by index: the model's two builds (WebP and KTX2) order the
 * room's triangles differently. A triangle is a window's when its centre is
 * within GLASS_MATCH_DISTANCE of one of these.
 */
export const GLASS_TRIANGLE_CENTRES: readonly (readonly [number, number, number])[] = [
  [-0.6072, -0.0356, -0.1202], [-0.6656, 0.0258, -0.1165], [0.0834, 0.0258, -0.402], [0.1528, -0.0356, -0.3903],
  [-0.9436, -0.0368, -0.1994], [-0.9436, 0.0244, -0.2273], [-0.2864, -0.0356, 0.3998], [-0.3457, 0.0258, 0.4113],
  [-0.9436, 0.0244, -0.3557], [-0.9436, -0.0368, -0.3163], [-0.3969, -0.0356, -0.3903], [-0.3236, 0.0258, -0.402],
  [-0.4407, -0.0367, 0.2937], [-0.4277, 0.0244, 0.3544], [-0.8144, 0.0258, -0.1358], [-0.875, -0.0356, -0.155],
  [-0.87, -0.0356, -0.3903], [-0.8047, 0.0258, -0.402], [0.9436, -0.0368, -0.1994], [0.9436, 0.0244, -0.2273],
  [0.9436, -0.0368, -0.3163], [0.9436, 0.0244, -0.3557], [-0.5158, -0.0367, -0.0466], [-0.5027, 0.0244, 0.0141],
  [-0.6403, -0.0356, -0.3903], [-0.5693, 0.0258, -0.402], [-0.1528, -0.0356, -0.3903], [-0.0834, 0.0258, -0.402],
  [0.5693, 0.0258, -0.402], [0.6403, -0.0356, -0.3903], [0.3236, 0.0258, -0.402], [0.3969, -0.0356, -0.3903],
  [0.8047, 0.0258, -0.402], [0.87, -0.0356, -0.3903], [0.4407, -0.0367, 0.2937], [0.4277, 0.0244, 0.3544],
  [0.8144, 0.0258, -0.1358], [0.875, -0.0356, -0.155], [0.5158, -0.0367, -0.0466], [0.5027, 0.0244, 0.0141],
  [0.4782, -0.0367, 0.1235], [0.6072, -0.0356, -0.1202], [0.6656, 0.0258, -0.1165], [0.1357, 0.0258, 0.4113],
  [0.0753, -0.0356, 0.3998], [0.3457, 0.0258, 0.4113], [0.2864, -0.0356, 0.3998], [0.4653, 0.0244, 0.1843],
  [-0.4653, 0.0244, 0.1843], [-0.4782, -0.0367, 0.1235], [-0.0753, -0.0356, 0.3998], [-0.1357, 0.0258, 0.4113],
];
export const GLASS_MATCH_DISTANCE = 0.003;
/**
 * The two front windows by the centreline that carry the HUD — left and
 * right as seen from inside, looking over the bow — by their triangles'
 * centres: all the stats on them, so one need not walk round to read them.
 */
export const HUD_WINDOW_CENTRES = [
  [
    [0.1357, 0.0258, 0.4113],
    [0.0753, -0.0356, 0.3998],
  ],
  [
    [-0.0753, -0.0356, 0.3998],
    [-0.1357, 0.0258, 0.4113],
  ],
] as const;
/** The HUD's canvas resolution, in pixels per world unit of window. */
export const HUD_TEXTURE_PIXELS_PER_UNIT = 1400;

/**
 * Where the eye starts, in the room's own space (about -1 to 1 across):
 * at the windows' mid-height, a few metres back from the front ones.
 */
export const EYE_START = { x: 0, y: -0.005, z: 0.1 } as const;
/**
 * The floor one may walk, in the room's own space: its wide aft part, between
 * the wings, and its narrower forward part — inside its walls, off the glass.
 */
export const WALKABLE_AREAS = [
  { x: [-0.86, 0.86], z: [-0.34, -0.17] },
  { x: [-0.37, 0.37], z: [-0.17, 0.35] },
] as const;
/** Walking speed, in the room's own units per second. */
export const WALK_SPEED = 0.16;

/**
 * How bright the HUD's light is on the glass, over white: past 1, the bloom
 * spreads it into a halo round the text — the futuristic glow.
 */
export const HUD_INTENSITY = 3.4;
/** How much the glass itself tints the view, by day, and how much it dims it by night. */
export const GLASS_OPACITY = 0.07;
export const NIGHT_GLASS_OPACITY = 0.72;

/** How far the eye may look up and down, in degrees: round, it turns all the way. */
export const LOOK_LIMITS = { pitchUp: 20, pitchDown: 30 } as const;
/** Degrees the view turns per pixel the mouse moves, while it looks about (the pointer taken). */
export const MOUSE_LOOK_SPEED = 0.12;
/** The field of view the wheel zooms between, degrees; the bridge opens at the widest. */
export const FOV_LIMITS = { narrowest: 26, widest: 56 } as const;
export const FOV_STEP = 4;
/** The scene's own field of view, restored on leaving the bridge. */
export const SCENE_FOV = 45;

/** What the HUD shows: every system, only those alarmed, or nothing — clear glass. */
export const HUD_MODES = ["full", "alarms", "clear"] as const;
export type HudMode = (typeof HUD_MODES)[number];

/** The systems the HUD shows, and the window each is on by default: left, then right. */
export const PANE_SYSTEMS = ["energy", "wind", "nav", "hull", "propulsion"] as const;
export type PaneSystem = (typeof PANE_SYSTEMS)[number];
export const DEFAULT_WINDOW_SYSTEMS: PaneSystem[][] = [
  ["nav", "hull"],
  ["energy", "wind", "propulsion"],
];

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
