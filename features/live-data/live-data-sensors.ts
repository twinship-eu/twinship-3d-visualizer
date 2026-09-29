/**
 * The ship's sensors: what each measures, on which component, where on it,
 * and when its reading becomes a warning or an alarm. Sample catalogue, as
 * the cockpit design shows it, until the ship's own is connected.
 */

export type SensorDefinition = {
  id: string;
  /** The component it is fitted to, by its label in the ontology tree. */
  componentLabel: string;
  /** Its name in full, and short, for the callouts. */
  name: string;
  shortName: string;
  /** What it measures, and in what. */
  quantity: string;
  unit: string;
  /** From these readings on, a warning and an alarm. */
  warnAt?: number;
  alarmAt?: number;
  /**
   * Where on its component it sits, as shares of the component's bounding box
   * in the scene: across the beam (x), up (y) and along the ship (z), 0 to 1.
   */
  position: [number, number, number];
  /** The simulation's reading: where it sits and how far it wanders. */
  simulated: { value: number; spread: number };
};

/** Bending stress, as a share of what the hull is allowed: warning and alarm limits. */
const STRESS_LIMITS = { warnAt: 80, alarmAt: 90 } as const;

const strainGauge = (index: number, frame: number, z: number, value: number): SensorDefinition => ({
  id: `SG-0${index}`,
  componentLabel: "Base Hull",
  name: `Strain gauge SG-0${index} · Frame ${frame}`,
  shortName: `SG-0${index} · Frame ${frame}`,
  quantity: "Bending stress",
  unit: "%",
  ...STRESS_LIMITS,
  position: [1, 0.38, z],
  simulated: { value, spread: 1.2 },
});

export const SENSORS: SensorDefinition[] = [
  strainGauge(1, 40, 0.16, 54),
  strainGauge(2, 76, 0.33, 58),
  // Frame 112 the highest: back under the 80% warning since its alarm
  strainGauge(3, 112, 0.5, 72),
  strainGauge(4, 140, 0.66, 66),
  strainGauge(5, 176, 0.83, 49),
  {
    id: "EX-4",
    componentLabel: "Engine",
    name: "Exhaust gas · Cylinder 4",
    shortName: "EX-4 · Cyl 4",
    quantity: "Exhaust temperature",
    unit: "°C",
    warnAt: 400,
    alarmAt: 420,
    position: [0.5, 0.8, 0.4],
    // Over the 400 °C warning: the simulation's active alarm
    simulated: { value: 406, spread: 2 },
  },
  {
    id: "CW-1",
    componentLabel: "Engine",
    name: "Cooling water outlet",
    shortName: "CW-1",
    quantity: "Coolant temperature",
    unit: "°C",
    warnAt: 88,
    alarmAt: 95,
    position: [0.3, 0.5, 0.2],
    simulated: { value: 78, spread: 0.6 },
  },
  {
    id: "LO-1",
    componentLabel: "Engine",
    name: "Lube oil inlet",
    shortName: "LO-1",
    quantity: "Lube oil pressure",
    unit: "bar",
    position: [0.7, 0.3, 0.3],
    simulated: { value: 4.2, spread: 0.05 },
  },
  {
    id: "MB-2",
    componentLabel: "Engine",
    name: "Main bearing 2",
    shortName: "MB-2",
    quantity: "Bearing temperature",
    unit: "°C",
    warnAt: 85,
    alarmAt: 90,
    position: [0.5, 0.2, 0.6],
    simulated: { value: 71, spread: 0.5 },
  },
  {
    id: "VB-1",
    componentLabel: "Engine",
    name: "Engine frame vibration",
    shortName: "VB-1",
    quantity: "Vibration",
    unit: "mm/s",
    warnAt: 7,
    alarmAt: 11,
    position: [0.5, 0.5, 0.85],
    simulated: { value: 3.1, spread: 0.2 },
  },
  {
    id: "PS-1",
    componentLabel: "Propellers",
    name: "Shaft torque, port",
    shortName: "PS-1",
    quantity: "Shaft torque",
    unit: "kNm",
    position: [0.25, 0.5, 0.5],
    simulated: { value: 330, spread: 4 },
  },
  {
    id: "PS-2",
    componentLabel: "Propellers",
    name: "Shaft torque, starboard",
    shortName: "PS-2",
    quantity: "Shaft torque",
    unit: "kNm",
    position: [0.75, 0.5, 0.5],
    simulated: { value: 327, spread: 4 },
  },
  {
    id: "SB-1",
    componentLabel: "Propellers",
    name: "Stern tube bearing",
    shortName: "SB-1",
    quantity: "Bearing temperature",
    unit: "°C",
    warnAt: 60,
    alarmAt: 70,
    position: [0.5, 0.7, 0.8],
    simulated: { value: 41, spread: 0.4 },
  },
];

/** The sensors fitted to a component. */
export function sensorsOf(componentLabel: string): SensorDefinition[] {
  return SENSORS.filter((sensor) => sensor.componentLabel === componentLabel);
}

export function findSensor(sensorId: string): SensorDefinition | undefined {
  return SENSORS.find((sensor) => sensor.id === sensorId);
}

/** How a reading stands against its sensor's limits. */
export type SensorState = "normal" | "warning" | "alarm";

export function sensorState(sensor: SensorDefinition, reading: number): SensorState {
  if (sensor.alarmAt !== undefined && reading >= sensor.alarmAt) return "alarm";
  if (sensor.warnAt !== undefined && reading >= sensor.warnAt) return "warning";
  return "normal";
}
