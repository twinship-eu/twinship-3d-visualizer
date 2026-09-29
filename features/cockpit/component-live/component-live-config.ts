/**
 * Each component's live panel and trends, as the cockpit design shows them
 * for the Base Hull; the other components' in the same pattern. Health
 * scores and lifecycle shares are sample values until the ship reports them.
 */
import { sensorsOf } from "@/features/live-data/live-data-sensors";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import type { ComponentLiveDefinition, TrendCard } from "./component-live-types";

/** The hull's highest bending stress, over its strain gauges: % of allowable. */
export const hullBendingStress = (snapshot: LiveSnapshot) =>
  Math.max(...sensorsOf("Base Hull").map((sensor) => snapshot.sensors[sensor.id] ?? 0));

const DESIGN_DRAFT_M = 7.0;
/** The draught a full bar stands for, m. */
const FULL_DRAFT_BAR_M = 8.0;
const STRESS_LIMITS = [
  { value: 80, tone: "warn" as const },
  { value: 90, tone: "alarm" as const },
];

const percent = (value: number) => `${value.toFixed(0)}%`;
const oneDecimal = (unit: string) => (value: number) => `${value.toFixed(1)} ${unit}`;
const twoDecimals = (unit: string) => (value: number) => `${value.toFixed(2)} ${unit}`;
const pair = (digits: number, unit: string) => (values: number[]) =>
  `${values.map((value) => value.toFixed(digits)).join(" / ")}${unit}`;

const BENDING_STRESS_TREND: TrendCard = {
  title: "Bending stress · % allowable",
  series: [{ label: "", value: hullBendingStress, strokeClass: "stroke-warn" }],
  format: ([stress]) => percent(stress),
  limits: STRESS_LIMITS,
};

export const COMPONENT_LIVE: Record<string, ComponentLiveDefinition> = {
  "Base Hull": {
    health: { score: 94, caption: "Combined from stress, fatigue and coating sensors" },
    readings: [
      {
        label: "Bending stress",
        value: hullBendingStress,
        format: percent,
        bar: (snapshot) => hullBendingStress(snapshot) / 100,
        barClass: "bg-ok",
        hasTrend: true,
      },
      {
        label: "Mean draft",
        detail: `design ${DESIGN_DRAFT_M.toFixed(1)} m`,
        value: (snapshot) => snapshot.systems.hull.meanDraftM,
        format: twoDecimals("m"),
        bar: (snapshot) => snapshot.systems.hull.meanDraftM / FULL_DRAFT_BAR_M,
        barClass: "bg-accent",
        hasTrend: true,
      },
      {
        label: "Trim",
        detail: "by stern",
        value: (snapshot) => snapshot.systems.hull.trimM,
        format: twoDecimals("m"),
      },
      {
        label: "Slamming events",
        value: (snapshot) => snapshot.systems.hull.slammingPerHour,
        format: oneDecimal("/h"),
        hasTrend: true,
      },
      {
        label: "Ballast tanks filled",
        value: (snapshot) => snapshot.systems.hull.ballastPct,
        format: percent,
        bar: (snapshot) => snapshot.systems.hull.ballastPct / 100,
        barClass: "bg-system-propeller",
      },
    ],
    lifecycle: [
      { label: "Fatigue life used", pct: 23, barClass: "bg-system-hull" },
      { label: "Until next class survey", pct: 61, note: "[DATE]", barClass: "bg-accent" },
      { label: "Hull coating condition", pct: 88, barClass: "bg-ok" },
    ],
    trends: [
      BENDING_STRESS_TREND,
      {
        title: "Draft",
        series: [
          { label: "fore", value: (snapshot) => snapshot.systems.hull.draftForeM, strokeClass: "stroke-system-propeller" },
          { label: "aft", value: (snapshot) => snapshot.systems.hull.draftAftM, strokeClass: "stroke-accent" },
        ],
        format: pair(2, " m"),
      },
      {
        title: "Motion",
        series: [
          { label: "roll", value: (snapshot) => snapshot.systems.hull.rollDeg, strokeClass: "stroke-warn" },
          { label: "pitch", value: (snapshot) => snapshot.systems.hull.pitchDeg, strokeClass: "stroke-accent" },
        ],
        format: pair(1, "°"),
      },
    ],
  },
  Engine: {
    health: { score: 91, caption: "Combined from temperature, pressure and vibration sensors" },
    readings: [
      {
        label: "Load",
        value: (snapshot) => snapshot.systems.energy.engineLoadPct,
        format: percent,
        bar: (snapshot) => snapshot.systems.energy.engineLoadPct / 100,
        barClass: "bg-system-energy",
        hasTrend: true,
      },
      { label: "Speed", value: (snapshot) => snapshot.systems.energy.engineRpm, format: (value) => `${value.toFixed(0)} rpm` },
      {
        label: "Fuel",
        value: (snapshot) => snapshot.systems.energy.fuelTph,
        format: twoDecimals("t/h"),
        hasTrend: true,
        ontologyParameter: "twinship fuel consumption rate in MT per hr",
      },
      {
        label: "Exhaust · Cyl 4",
        detail: "alarm 420 °C",
        value: (snapshot) => snapshot.sensors["EX-4"] ?? 0,
        format: (value) => `${value.toFixed(0)} °C`,
        bar: (snapshot) => (snapshot.sensors["EX-4"] ?? 0) / 420,
        barClass: "bg-warn",
        hasTrend: true,
      },
      {
        label: "Coolant",
        value: (snapshot) => snapshot.systems.energy.coolantTempC,
        format: (value) => `${value.toFixed(0)} °C`,
        ontologyParameter: "twinship ME cooling water temperature in degrees C",
      },
    ],
    lifecycle: [
      { label: "Running hours to overhaul", pct: 72, note: "[hours]", barClass: "bg-system-hull" },
      { label: "Lube oil condition", pct: 84, barClass: "bg-ok" },
    ],
    trends: [
      {
        title: "Load · %",
        series: [{ label: "", value: (snapshot) => snapshot.systems.energy.engineLoadPct, strokeClass: "stroke-system-energy" }],
        format: ([load]) => percent(load),
      },
      {
        title: "Exhaust · Cyl 4",
        series: [{ label: "", value: (snapshot) => snapshot.sensors["EX-4"] ?? 0, strokeClass: "stroke-warn" }],
        format: ([temperature]) => `${temperature.toFixed(0)} °C`,
        limits: [
          { value: 400, tone: "warn" },
          { value: 420, tone: "alarm" },
        ],
      },
      {
        title: "Fuel",
        series: [{ label: "", value: (snapshot) => snapshot.systems.energy.fuelTph, strokeClass: "stroke-accent" }],
        format: ([fuel]) => `${fuel.toFixed(2)} t/h`,
      },
    ],
  },
  Propellers: {
    health: { score: 96, caption: "Combined from torque and bearing sensors" },
    readings: [
      {
        label: "Shaft speed",
        value: (snapshot) => snapshot.systems.propulsion.shaftRpm,
        format: (value) => `${value.toFixed(0)} rpm`,
        hasTrend: true,
      },
      {
        label: "Pitch",
        value: (snapshot) => snapshot.systems.propulsion.pitchPct,
        format: percent,
        bar: (snapshot) => snapshot.systems.propulsion.pitchPct / 100,
        barClass: "bg-system-propeller",
      },
      { label: "Shaft power", value: (snapshot) => snapshot.systems.propulsion.powerMw, format: twoDecimals("MW") },
      {
        label: "Stern tube bearing",
        value: (snapshot) => snapshot.sensors["SB-1"] ?? 0,
        format: (value) => `${value.toFixed(0)} °C`,
        hasTrend: true,
      },
    ],
    lifecycle: [{ label: "Blade condition", pct: 91, barClass: "bg-ok" }],
    trends: [
      {
        title: "Shaft speed",
        series: [{ label: "", value: (snapshot) => snapshot.systems.propulsion.shaftRpm, strokeClass: "stroke-system-propeller" }],
        format: ([rpm]) => `${rpm.toFixed(0)} rpm`,
      },
      {
        title: "Torque",
        series: [
          { label: "port", value: (snapshot) => snapshot.sensors["PS-1"] ?? 0, strokeClass: "stroke-system-propeller" },
          { label: "stbd", value: (snapshot) => snapshot.sensors["PS-2"] ?? 0, strokeClass: "stroke-accent" },
        ],
        format: pair(0, " kNm"),
      },
      {
        title: "Pitch · %",
        series: [{ label: "", value: (snapshot) => snapshot.systems.propulsion.pitchPct, strokeClass: "stroke-accent" }],
        format: ([pitch]) => percent(pitch),
      },
    ],
  },
  WAPS: {
    health: { score: 97, caption: "Combined from rotor speed and thrust sensors" },
    readings: [
      {
        label: "Thrust",
        value: (snapshot) => snapshot.systems.windAssist.thrustKn,
        format: (value) => `${value.toFixed(0)} kN`,
        hasTrend: true,
      },
      {
        label: "Fuel saving",
        value: (snapshot) => snapshot.systems.windAssist.fuelSavingPct,
        format: percent,
        ontologyParameter: "twinship WASP power reduction efficiency percentage",
        bar: (snapshot) => snapshot.systems.windAssist.fuelSavingPct / 100,
        barClass: "bg-ok",
      },
      { label: "Rotor 1", value: (snapshot) => snapshot.systems.windAssist.rotorRpm[0], format: (value) => `${value.toFixed(0)} rpm` },
      { label: "Rotor 2", value: (snapshot) => snapshot.systems.windAssist.rotorRpm[1], format: (value) => `${value.toFixed(0)} rpm` },
    ],
    lifecycle: [{ label: "Rotor bearing life used", pct: 18, barClass: "bg-system-hull" }],
    trends: [
      {
        title: "Thrust",
        series: [{ label: "", value: (snapshot) => snapshot.systems.windAssist.thrustKn, strokeClass: "stroke-system-hull" }],
        format: ([thrust]) => `${thrust.toFixed(0)} kN`,
      },
      {
        title: "Rotors",
        series: [
          { label: "1", value: (snapshot) => snapshot.systems.windAssist.rotorRpm[0], strokeClass: "stroke-system-hull" },
          { label: "2", value: (snapshot) => snapshot.systems.windAssist.rotorRpm[1], strokeClass: "stroke-accent" },
        ],
        format: pair(0, " rpm"),
      },
      {
        title: "True wind",
        series: [{ label: "", value: (snapshot) => snapshot.navigation.trueWind.speedKn, strokeClass: "stroke-accent" }],
        format: ([wind]) => `${wind.toFixed(1)} kn`,
      },
    ],
  },
};

/** The trends shown while an alarm is in focus: the reading, and what drives it. By the alarm's sensor id. */
export const ALARM_CONTEXT_TRENDS: Record<string, TrendCard[]> = {
  "EX-4": [
    {
      title: "Exhaust · Cyl 4",
      series: [{ label: "", value: (snapshot) => snapshot.sensors["EX-4"] ?? 0, strokeClass: "stroke-warn" }],
      format: ([temperature]) => `${temperature.toFixed(0)} °C`,
      limits: [
        { value: 400, tone: "warn" },
        { value: 420, tone: "alarm" },
      ],
    },
    {
      title: "Engine load",
      note: "advised 60%",
      series: [{ label: "", value: (snapshot) => snapshot.systems.energy.engineLoadPct, strokeClass: "stroke-system-energy" }],
      format: ([load]) => `${load.toFixed(0)}%`,
      limits: [{ value: 60, tone: "advised" }],
    },
    {
      title: "Coolant",
      series: [{ label: "", value: (snapshot) => snapshot.systems.energy.coolantTempC, strokeClass: "stroke-accent" }],
      format: ([temperature]) => `${temperature.toFixed(0)} °C`,
    },
  ],
  "SG-03": [
    BENDING_STRESS_TREND,
    {
      title: "Significant wave height",
      series: [{ label: "", value: (snapshot) => snapshot.sea.significantWaveHeightM, strokeClass: "stroke-accent" }],
      format: ([height]) => `${height.toFixed(1)} m`,
    },
    {
      title: "Speed",
      note: "advised 9 kn",
      series: [{ label: "", value: (snapshot) => snapshot.navigation.speedOverGroundKn, strokeClass: "stroke-system-propeller" }],
      format: ([speed]) => `${speed.toFixed(1)} kn`,
      limits: [{ value: 9, tone: "advised" }],
    },
  ],
};

/** More readings to watch with an alarm, beside its related sensors. By the alarm's sensor id. */
export const ALARM_RELATED_READINGS: Record<string, { label: string; value: (snapshot: LiveSnapshot) => string }[]> = {
  "EX-4": [
    { label: "Engine load", value: (snapshot) => `${snapshot.systems.energy.engineLoadPct.toFixed(0)}%` },
    { label: "Fuel", value: (snapshot) => `${snapshot.systems.energy.fuelTph.toFixed(2)} t/h` },
  ],
  "SG-03": [
    { label: "Slamming events", value: (snapshot) => `${snapshot.systems.hull.slammingPerHour.toFixed(1)} /h` },
    { label: "Pitch", value: (snapshot) => `${snapshot.systems.hull.pitchDeg.toFixed(1)}°` },
  ],
};
