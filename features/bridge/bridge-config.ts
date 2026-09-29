/**
 * The bridge view: the camera in the control room, free to walk and look
 * about in it and out through all its windows; the two front windows carry
 * the head-up display — the cockpit design's "layers on the glass".
 */

/** The model's control room, whose windows turn to glass, and its label in the tree. */
export const CONTROL_ROOM_OBJECT_NAME = "ControlRoom";
export const CONTROL_ROOM_LABEL = "Control room";

/**
 * The room's windows: their triangles in its mesh, found by their glass in
 * its texture (the lighter blue) — 26 windows of two triangles: the front
 * row, the wings, the sides and the back. For the mesh they were found in,
 * whose triangle count is checked: another export is left as it is.
 */
export const ROOM_FACE_COUNT = 1088;
export const GLASS_FACES = [
  242, 248, 430, 431, 450, 456, 466, 467, 520, 521, 634, 638, 647, 651, 656, 658, 666, 670, 684, 688, 694, 698, 705, 709, 722, 726,
  740, 744, 783, 784, 795, 796, 805, 806, 979, 982, 988, 991, 1007, 1010, 1017, 1027, 1028, 1069, 1070, 1077, 1078, 1079, 1080,
  1081, 1084, 1085,
] as const;
/**
 * The two front windows by the centreline that carry the HUD — left and
 * right as seen from inside, looking over the bow: all the stats on them, so
 * one need not walk round the room to read them.
 */
export const HUD_WINDOWS = [
  [1069, 1070],
  [1084, 1085],
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
/** Degrees the view turns per CSS pixel dragged. */
export const LOOK_SPEED = 0.18;
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
