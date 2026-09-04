export const SHIP_VISUALIZER_LAYOUT = {
  MAX_LEFT_PANEL_WIDTH_PX: 330,
} as const;

/**
 * TwinShip V2 model: PBR textured GLB, built from the raw Blender export by
 * `npm run optimize:ship-model`. The `-v3` in the filename is the export's own
 * numbering and does not match the V1/V2 model versions.
 */
export const SHIP_MODEL_JOINED_GLB = "/ship/twinship-v3.glb";


/**
 * The raw V2 Blender export with full-size 4K PNG textures, ~176 MB. Only ever
 * loaded through the development-only model-variant toggle, as a reference to
 * compare the optimized build against. Never referenced by a production build.
 */
export const RAW_SHIP_MODEL_GLB = "/ship/TwinShip_Update/TwinShip_Update.glb";

/**
 * The V1 model, shipped before the V2 update. Kept as a reference to compare
 * the new export against what it replaced, and loaded only through the
 * development-only model-variant toggle. The `v2` in the filename is the
 * export's own numbering and does not match the V1/V2 model versions.
 */
export const PREVIOUS_SHIP_MODEL_GLB = "/ship/twinship v2.glb";

/** The veil harness is a tuning tool, never product UI. */
export const IS_DEPTH_VEIL_HARNESS_ENABLED =
  process.env.NODE_ENV === "development";

/** The raw reference model is far too large to offer outside local development. */
export const IS_MODEL_VARIANT_TOGGLE_ENABLED =
  process.env.NODE_ENV === "development";

/** Default model when opening the ship visualizer (first subroute). */
export const DEFAULT_SHIP_MODEL_PATH = SHIP_MODEL_JOINED_GLB;

/** Default ship texture (Atlas_Twinship), same folder as ship models. */
export const SHIP_TEXTURE_PATH = "/ship/Atlas_Twinship.png";

/** Default ship mesh color (unselected). */
export const SHIP_COLOR = "#ffffff";

/** Color of the selected ship component. */
export const SELECTED_PART_COLOR = "#7f56d9";

/** Scale applied to the ship model in the 3D scene. */
export const SHIP_MODEL_SCALE = 0.50;

/** Opacity of ship parts when another part is selected (0 = invisible, 1 = opaque). */
export const UNSELECTED_PART_OPACITY = 0.35;

/** Opacity of a hovered part when a different part is selected (0 = invisible, 1 = opaque). */
export const HOVERED_PART_OPACITY_WHEN_OTHER_SELECTED = 0.85;

/** Default camera position when viewing the full ship. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [60, 30, 60];

/** Default camera target (look-at point) when viewing the full ship. */
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

/** Duration in seconds for camera transition when selecting a part or resetting. */
export const CAMERA_TRANSITION_DURATION_S = 0.6;

/** Vertical offset (Y) for the ship so it sits at water level. */
export const SHIP_VERTICAL_OFFSET = -3;

/** Floating animation: vertical bobbing amplitude (world units). */
export const FLOATING_BOB_AMPLITUDE = 0.15;
/** Floating animation: bobbing speed (radians per second). */
export const FLOATING_BOB_SPEED = 1;
/** Floating animation: pitch (nose up/down) amplitude in radians. */
export const FLOATING_PITCH_AMPLITUDE = 0.015;
/** Floating animation: roll (tilt left/right) amplitude in radians. */
export const FLOATING_ROLL_AMPLITUDE = 0.02;
/** Floating animation: pitch/roll cycle speed multiplier (phase variation). */
export const FLOATING_TILT_SPEED = 0.96;

/** Y position when ship is in interaction mode (out of water). */
export const SHIP_INTERACTION_Y_OFFSET = 2;

/** Duration in ms for ship translate in/out of water. */
export const SHIP_TRANSITION_DURATION_MS = 400;

/** Idle time in ms before translating back to animated state (no hover, no selection). */
export const SHIP_IDLE_RESET_MS = 2000;

/** Side nav: max height per section before showing scroll. */
export const SHIP_TREE_SECTION_MAX_HEIGHT_PX = 300;

/**
 * Object names that should be drawn with a specific color for visibility.
 * Applied to the object and all its descendants (meshes).
 */
export const OBJECT_COLOR_OVERRIDES: Record<string, string> = {
} as const;

/** Name of the model node holding both propellers. */
export const PROPELLERS_OBJECT_NAME = "Propellers";

/** Propeller shaft speed in revolutions per minute. */
export const PROPELLER_RPM = 20;

const SECONDS_PER_MINUTE = 60;
const RADIANS_PER_REVOLUTION = Math.PI * 2;

export const PROPELLER_ANGULAR_SPEED_RAD_S =
  (PROPELLER_RPM / SECONDS_PER_MINUTE) * RADIANS_PER_REVOLUTION;

/**
 * Spin direction per shaft, ordered across the hull (negative x first).
 * Twin-screw vessels counter-rotate, so the two shafts get opposite signs.
 */
export const PROPELLER_SPIN_DIRECTIONS: readonly [number, number] = [1, -1];

/** Section definitions for mapping flat model tree into Hull / Superstructure / Deck / Propeller / Energy / Wind. */
export const SHIP_TREE_SECTIONS = [
  { id: "hull", label: "Hull" },
  { id: "superstructure", label: "Superstructure" },
  { id: "deck", label: "Deck equipment" },
  { id: "propeller", label: "Propeller system" },
  { id: "energy", label: "Energy system" },
  { id: "windAssisted", label: "Wind assisted propulsion system" },
] as const;

/** Section IDs whose elements cannot be selected (e.g. deck equipment). */
export const NON_SELECTABLE_SECTION_IDS: readonly string[] = ["deck"];
