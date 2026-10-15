import { ONTOLOGY_SUN_HEADING_DEG } from "@/features/3d-scene/lib/sky-controls-store";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/features/ship-visualizer/ship-visualizer-config";
import { offBowBearingDeg } from "@/features/3d-scene/lib/compass-camera-pose";
import { formatBearing } from "@/features/live-data/lib/format-readings";
import type { SystemCard } from "./cockpit-systems";
import { currentKn, fuelPerMileKg } from "./lib/voyage-math";

/** The Voyage view's cards under the scene, left to right, as the design lays them out. */
export const VOYAGE_CARDS: SystemCard[] = [
  {
    id: "speed",
    title: "Speed over ground",
    dotClass: "bg-accent",
    strokeClass: "stroke-accent",
    value: (snapshot) => snapshot.navigation.speedOverGroundKn,
    format: (value) => value.toFixed(1),
    unit: "kn",
    readings: [
      { label: "STW", value: (snapshot) => snapshot.navigation.speedThroughWaterKn.toFixed(1) },
      { label: "Current", value: (snapshot) => `${currentKn(snapshot.navigation).toFixed(1)} kn` },
    ],
  },
  {
    id: "heading",
    title: "Heading & turn",
    dotClass: "bg-accent",
    strokeClass: "stroke-accent",
    value: (snapshot) => snapshot.navigation.headingDeg,
    format: formatBearing,
    unit: "",
    readings: [
      { label: "ROT", value: (snapshot) => snapshot.navigation.rateOfTurnDegPerMin.toFixed(1) },
      { label: "XTE", value: (snapshot) => `${snapshot.navigation.crossTrackErrorNm.toFixed(2)} nm` },
    ],
  },
  {
    id: "attitude",
    title: "Roll & pitch",
    dotClass: "bg-warn",
    strokeClass: "stroke-warn",
    value: (snapshot) => snapshot.systems.hull.rollDeg,
    format: (value) => `${value.toFixed(1)}°`,
    unit: "roll",
    readings: [
      { label: "Pitch", value: (snapshot) => `${snapshot.systems.hull.pitchDeg.toFixed(1)}°` },
      { label: "Heave", value: (snapshot) => `±${snapshot.systems.hull.heaveM.toFixed(1)} m` },
    ],
  },
  {
    id: "efficiency",
    title: "Efficiency",
    dotClass: "bg-system-energy",
    strokeClass: "stroke-system-energy",
    value: (snapshot) => fuelPerMileKg(snapshot) ?? 0,
    isAvailable: (snapshot) => fuelPerMileKg(snapshot) !== null,
    format: (value) => value.toFixed(0),
    unit: "kg/nm",
    readings: [
      { label: "Fuel", value: (snapshot) => `${snapshot.systems.energy.fuelTph.toFixed(2)} t/h` },
      { label: "Shaft", value: (snapshot) => `${snapshot.systems.propulsion.shaftRpm.toFixed(0)} rpm` },
    ],
  },
  {
    id: "windAssist",
    title: "Wind assist",
    dotClass: "bg-system-hull",
    strokeClass: "stroke-system-hull",
    value: (snapshot) => snapshot.systems.windAssist.thrustKn,
    format: (value) => value.toFixed(0),
    unit: "kN",
    readings: [
      { label: "Saving", value: (snapshot) => `${snapshot.systems.windAssist.fuelSavingPct.toFixed(0)}%` },
      { label: "Wind", value: (snapshot) => `${snapshot.navigation.trueWind.speedKn.toFixed(1)} kn` },
    ],
  },
];

/** Camera positions for the Voyage view's camera modes: [x, y, z], the ship at the origin, its bow to +z. */
export const VOYAGE_CAMERA = {
  /** Low off the quarter, close: the ship's side and stern large, its bow running away up the scene. */
  follow: { position: [68, 18, -66] as [number, number, number], target: [-4, 6, -6] as [number, number, number] },
  /** Straight down over the ship; a little aft, so the orbit controls keep their bearing. */
  topDown: { position: [0, 230, -18] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
} as const;

/**
 * Live data's camera: the Ontology's own view — its pose, and the compass
 * bearing it looks towards there (the heading the Ontology sets its ship on,
 * plus where its camera looks off the bow; the sun ahead of it) — the stage
 * the ship then turns on to its real heading, held as it turns
 * (SceneCompassCamera).
 */
export const LIVE_CAMERA_POSE = { position: DEFAULT_CAMERA_POSITION, target: DEFAULT_CAMERA_TARGET };
export const LIVE_CAMERA_BEARING_DEG = ONTOLOGY_SUN_HEADING_DEG + offBowBearingDeg(LIVE_CAMERA_POSE);

/** The hour the Voyage view shows the sun at, UTC: a mid-morning sun, the ship lit from the side it is seen from. */
export const VOYAGE_HOUR_UTC = 10 + 5 / 60;
