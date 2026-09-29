/**
 * The recorded ship: where its recording is, and how the columns of the
 * time-series workbook (docs/live-data) map onto the cockpit's snapshot.
 */

/**
 * The recording the viewer plays: the sample, or the one named by
 * NEXT_PUBLIC_LIVE_RECORDING_URL — e.g. in .env.local, for a recording that
 * cannot be shared, kept as public/live-data/*.local.json (neither committed).
 * None there, the simulation plays.
 */
export const RECORDING_URL =
  process.env.NEXT_PUBLIC_LIVE_RECORDING_URL || "/live-data/futuristic-vessel-timeseries.json";

/**
 * Playback opens this long after the recording's first warning, as the
 * simulation opens with its warning raised: the cockpit starts on the story.
 * From the recording's start when it has none.
 */
export const RECORDING_OPENS_AFTER_FIRST_WARNING_MS = 2 * 60_000;

/**
 * A reading must stay back within its limits this long for its alarm to
 * clear, as an alarm system's delay has it: noise about a limit is one alarm,
 * not a dozen.
 */
export const RECORDED_ALARM_CLEAR_DELAY_MS = 60_000;

/** The workbook's columns the snapshot reads, by what they are. */
export const RECORDING_COLUMNS = {
  latitude: "FV-RR-1.TWINSHIP-LATITUDE-IN-DEG",
  longitude: "FV-RR-1.TWINSHIP-LONGITUDE-IN-DEG",
  heading: "FV-RR-1.TWINSHIP-HEADING-IN-DEG",
  courseOverGround: "FV-RR-1.TWINSHIP-COURSE-OVER-GROUND-IN-DEG",
  speedOverGround: "FV-RR-1.TWINSHIP-SPEED-OVER-GROUND-IN-KN",
  speedThroughWater: "FV-RR-1.TWINSHIP-SPEED-THROUGH-WATER-IN-KN",
  rateOfTurn: "FV-RR-1.TWINSHIP-RATE-OF-TURN-IN-DEG_PER_MIN",
  draftFore: "FV-RR-1.TWINSHIP-DRAFT-FORE-IN-M",
  draftAft: "FV-RR-1.TWINSHIP-DRAFT-AFT-IN-M",
  autonomyLevel: "FV-RR-1.TWINSHIP-AUTONOMY-LEVEL",
  distanceToGo: "FV-RR-1.TWINSHIP-DISTANCE-TO-GO-IN-NM",
  trueWindSpeed: "FV-RR-1.TWINSHIP-TRUE-WIND-SPEED-IN-KN",
  trueWindFrom: "FV-RR-1.TWINSHIP-TRUE-WIND-DIRECTION-IN-DEG",
  gensetSpeed: ["FV-GN-1.TWINSHIP-SHAFT-SPEED-IN-REV_PER_MIN", "FV-GN-2.TWINSHIP-SHAFT-SPEED-IN-REV_PER_MIN"],
  gensetLoad: ["FV-GN-1.TWINSHIP-LOAD-PERCENTAGE", "FV-GN-2.TWINSHIP-LOAD-PERCENTAGE"],
  gensetFuel: ["FV-GN-1.TWINSHIP-FUEL-CONSUMPTION-RATE-IN-KG_PER_HR", "FV-GN-2.TWINSHIP-FUEL-CONSUMPTION-RATE-IN-KG_PER_HR"],
  gensetCoolant: ["FV-GN-1.TWINSHIP-COOLING-WATER-TEMPERATURE-IN-°C", "FV-GN-2.TWINSHIP-COOLING-WATER-TEMPERATURE-IN-°C"],
  gensetExhaust: ["FV-GN-1.TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-IN-°C", "FV-GN-2.TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-IN-°C"],
  gensetHottestCylinder: [
    "FV-GN-1.TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-CYLINDER",
    "FV-GN-2.TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-CYLINDER",
  ],
  batteryCharge: "FV-ESS-1.TWINSHIP-ESS-STATE-OF-CHARGE-PERCENTAGE",
  shaftPower: ["FV-EMSH-1.TWINSHIP-EMSH-POWER-IN-KW", "FV-EMSH-2.TWINSHIP-EMSH-POWER-IN-KW"],
  shaftSpeed: ["FV-EMSH-1.TWINSHIP-EMSH-SPEED-REV-PER-MIN", "FV-EMSH-2.TWINSHIP-EMSH-SPEED-REV-PER-MIN"],
  shaftTorque: ["FV-EMSH-1.TWINSHIP-EMSH-TORQUE-kNm", "FV-EMSH-2.TWINSHIP-EMSH-TORQUE-kNm"],
  propellerPitch: ["FV-CPP-1.TWINSHIP-CPP-PITCH-PERCENTAGE", "FV-CPP-2.TWINSHIP-CPP-PITCH-PERCENTAGE"],
  rudder: ["FV-CPP-1.TWINSHIP-RUDDER-ANGLE-DEGREE", "FV-CPP-2.TWINSHIP-RUDDER-ANGLE-DEGREE"],
  sailThrust: ["FV-WASP-1.TWINSHIP-WASP-THRUST-IN-kN", "FV-WASP-2.TWINSHIP-WASP-THRUST-IN-kN"],
  sailSaving: [
    "FV-WASP-1.TWINSHIP-WASP-POWER-REDUCTION-EFFICIENCY-PERCENTAGE",
    "FV-WASP-2.TWINSHIP-WASP-POWER-REDUCTION-EFFICIENCY-PERCENTAGE",
  ],
  sailFanSpeed: ["FV-WASP-1.TWINSHIP-WASP-FAN-SPEED-IN-REV_PER_MIN", "FV-WASP-2.TWINSHIP-WASP-FAN-SPEED-IN-REV_PER_MIN"],
} as const;

/** The sensors of the catalogue a column reads, by the sensor's id. */
export const RECORDED_SENSORS: Record<string, string> = {
  "EX-4": RECORDING_COLUMNS.gensetExhaust[0],
  "CW-1": RECORDING_COLUMNS.gensetCoolant[0],
  "PS-1": RECORDING_COLUMNS.shaftTorque[0],
  "PS-2": RECORDING_COLUMNS.shaftTorque[1],
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].map((gauge) => [`SG-0${gauge}`, `SG-0${gauge}.TWINSHIP-BENDING-STRESS-PERCENTAGE-OF-ALLOWABLE`])
  ),
};

/**
 * The 3D model's part standing for each component of the knowledge graph, by
 * the start of its id: the model's parts are coarser than the graph's.
 */
export const RECORDED_COMPONENT_PARTS: [idPrefix: string, partLabel: string][] = [
  ["FV-GN-", "Engine"],
  ["FV-ESS-", "Engine"],
  ["FV-EMSH-", "Propellers"],
  ["FV-EMM-", "Propellers"],
  ["FV-CPP-", "Propellers"],
  ["FV-WASP-", "WAPS"],
  ["FV-RR-", "Base Hull"],
  ["SG-", "Base Hull"],
];
