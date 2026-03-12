export const SHIP_VISUALIZER_LAYOUT = {
  MAX_LEFT_PANEL_WIDTH_PX: 400,
} as const;

/** Path to the ship GLB model in public (legacy). */
export const SHIP_MODEL_PATH = "/ship/TwinShip.glb";

/** TwinShip V4 FBX model. */
export const SHIP_MODEL_V4 = "/ship/TwinShipv4.fbx";
export const SHIP_MODEL_JOINED = "/ship/TwinShip_Joined.fbx";
export const SHIP_MODEL_W_ENGINE = "/ship/TwinShip_WEngine.fbx";
export const SHIP_MODEL_JOINED_GLB = "/ship/TwinShipv12_Joined.glb";

/** TwinShip V4 Solar FBX model. */
export const SHIP_MODEL_V4_SOLAR = "/ship/TwinShipv4_Solar.fbx";

/** Default model when opening the ship visualizer (first subroute). */
export const DEFAULT_SHIP_MODEL_PATH = SHIP_MODEL_W_ENGINE;

/** Default ship texture (Atlas_Twinship), same folder as ship models. */
export const SHIP_TEXTURE_PATH = "/ship/Atlas_Twinship.png";

/** Default ship mesh color (unselected). */
export const SHIP_COLOR = "#ffffff";

/** Color of the selected ship component. */
export const SELECTED_PART_COLOR = "#7f56d9";

/** Scale applied to the ship model in the 3D scene. */
export const SHIP_MODEL_SCALE = 0.005;

/** Opacity of ship parts when another part is selected (0 = invisible, 1 = opaque). */
export const UNSELECTED_PART_OPACITY = 0.35;

/** Opacity of a hovered part when a different part is selected (0 = invisible, 1 = opaque). */
export const HOVERED_PART_OPACITY_WHEN_OTHER_SELECTED = 0.85;

/** Default camera position when viewing the full ship. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [70, 50, 70];

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

/** Section definitions for mapping flat model tree into Hull / Superstructure / Deck / Propulsion. */
export const SHIP_TREE_SECTIONS = [
  { id: "hull", label: "Hull" },
  { id: "superstructure", label: "Superstructure" },
  { id: "deck", label: "Deck equipment" },
  { id: "propulsion", label: "Propulsion" },
] as const;
