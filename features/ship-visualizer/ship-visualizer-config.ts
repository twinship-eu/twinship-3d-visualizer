export const SHIP_VISUALIZER_LAYOUT = {
  MAX_LEFT_PANEL_WIDTH_PX: 400,
} as const;

/** Path to the ship GLB model in public (legacy). */
export const SHIP_MODEL_PATH = "/ship/TwinShip.glb";

/** TwinShip V4 FBX model. */
export const SHIP_MODEL_V4 = "/ship/TwinShipv4.fbx";

/** TwinShip V4 Solar FBX model. */
export const SHIP_MODEL_V4_SOLAR = "/ship/TwinShipV4_Solar.fbx";

/** Default model when opening the ship visualizer (first subroute). */
export const DEFAULT_SHIP_MODEL_PATH = SHIP_MODEL_V4;

/** Default ship mesh color (unselected). */
export const SHIP_COLOR = "#ffffff";

/** Color of the selected ship component. */
export const SELECTED_PART_COLOR = "#7f56d9";

/** Scale applied to the ship model in the 3D scene. */
export const SHIP_MODEL_SCALE = 0.005;

/** Opacity of ship parts when another part is selected (0 = invisible, 1 = opaque). */
export const UNSELECTED_PART_OPACITY = 0.3;

/** Default camera position when viewing the full ship. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [70, 50, 70];

/** Default camera target (look-at point) when viewing the full ship. */
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

/** Duration in seconds for camera transition when selecting a part or resetting. */
export const CAMERA_TRANSITION_DURATION_S = 0.6;
