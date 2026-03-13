import type { ShipTreeNode } from "./ship-visualizer-types";
import type { ObjectDetails } from "./components/selection-details-modal-types";

const DEFAULT_DETAILS: ObjectDetails = {
  description: "Details for this component will be available in a future version.",
  parameters: [],
  connectedComponents: [],
};

const OBJECT_DETAILS_BY_LABEL: Record<string, ObjectDetails> = {
  "Base Hull": {
    title: "Base Hull",
    tags: ["Hull"],
    description:
      "The main hull structure providing buoyancy and distributing loads across the vessel. General specifications of the futuristic RoRo vessel.",
    parameters: [
      { name: "Ship type", value: "RoRo" },
      { name: "Length over all", value: "abt. 200 m" },
      { name: "Breadth moulded", value: "abt. 31 m" },
      { name: "DWT", value: "17000 DWT" },
      { name: "Payload", value: "Abt. 11000 tons" },
      { name: "Cargo lane meter", value: "Abt. 4000 lm" },
      { name: "Design draught", value: "abt. 7.0 m" },
      { name: "Design speed", value: "abt. 18 kn" },
      { name: "Unmanned vessel", value: "Yes" },
      { name: "Route profile", value: "Northern Europe" },
      { name: "Engine and power", value: "Dual fuel Battery Hybrid" },
      { name: "Fuel type(s)", value: "Bio-fuel (B100) and Ammonia (Green)" },
      { name: "Engine types", value: "Wartsila 10V31 DF" },
      { name: "Battery bank", value: "Estm. 7 MWhr for low load operation and power back-up" },
      { name: "Propeller", value: "CPP, Two propeller, 4-bladed, diameter 4,8 meter" },
      { name: "Rudder", value: "2 pair of gate rudders" },
      { name: "Stern & Bow thrusters", value: "BOW 2 x 1800 kW" },
      { name: "Endurance", value: "Two (2) Type C tanks each abt. 360 m³, range abt. 1600 nm" },
      { name: "Electrical power system", value: "AC and DC low loss design" },
      { name: "Shore power", value: "For recharge battery and zero emission in port" },
    ],
    connectedComponents: [
      { id: "Hull top towers", label: "Hull top towers", category: "Hull" },
      { id: "Control room", label: "Control room", category: "Hull" },
      { id: "Wind Towers", label: "Wind Towers", category: "Wind assisted propulsion system" },
      { id: "Engine", label: "Engine", category: "Energy system" },
    ],
  },
  "Hull top towers": {
    title: "Hull top towers",
    tags: ["Hull"],
    description:
      "Upper hull tower structures used for supporting equipment and providing visibility. Part of the RoRo vessel.",
    parameters: [
     
    ],
    connectedComponents: [
      { id: "Base Hull", label: "Base Hull", category: "Hull" },
    ],
  },
  "Control room": {
    title: "Control room",
    tags: ["Hull"],
    description:
      "The main operational control space housing navigation, monitoring, and communication systems.",
    parameters: [],
    connectedComponents: [
      { id: "Base Hull", label: "Base Hull", category: "Hull" },
      { id: "Radio", label: "Radio", category: "Hull" },
    ],
  },
  Radio: {
    title: "Radio",
    tags: ["Hull"],
    description:
      "Radio and antenna systems used for ship-to-ship and ship-to-shore communication.",
    parameters: [],
    connectedComponents: [
      { id: "Control room", label: "Control room", category: "Hull" },
    ],
  },
  Container: {
    title: "Container",
    tags: ["Deck equipment"],
    description: "On-deck container used for cargo and equipment storage.",
    parameters: [],
    connectedComponents: [],
  },
  Crane: {
    title: "Crane",
    tags: ["Deck equipment"],
    description: "Deck crane used for handling cargo and equipment on board.",
    parameters: [],
    connectedComponents: [],
  },
  Propellers: {
    title: "Propellers",
    titleHref: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#PropellerSystem",
    tags: ["Propeller system"],
    description:
      "A rotating device with blades that converts rotational motion into thrust. CPP (Controllable Pitch Propeller) and FPP (Fixed Pitch Propeller). Below are the parameters for the propeller system.",
    parameters: [
      { name: "twinship propeller blades", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerBlades" },
      { name: "twinship propeller diameter mm", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerDiameterMm" },
      { name: "twinship propeller efficiency", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerEfficiency" },
      { name: "twinship propeller expanded area ratio percentage", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerExpandedAreaRatioPercentage" },
      { name: "twinship propeller hub ratio", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerHubRatio" },
      { name: "twinship propeller pitch diameter ratio", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerPitchDiameterRatio" },
      { name: "twinship propeller pitch max in percentage", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerPitchMaxInPercentage" },
      { name: "twinship propeller skew angle degree", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPropellerSkewAngleDegree" },
      { name: "twinship rudder angle degree", value: "", href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twRudderAngleDegree" },
    ],
    connectedComponents: [
      { id: "Engine", label: "Engine", category: "Energy system" },
    ],
  },
  Engine: {
    title: "Engine",
    titleHref:
      "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#MainEngineSystem",
    tags: ["Energy system"],
    description:
      "Main propulsion engine system. Includes shaft-related properties (power, torque, speed) as the main engine drives the propeller shaft. Below are the parameters for the main engine system.",
    parameters: [
      {
        name: "twinship common DO mode",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twCommonDOMode",
      },
      {
        name: "twinship common fuel mode",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twCommonFuelMode",
      },
      {
        name: "twinship flowrate max in kg per hr",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twFlowrateMaxInKgPerHr",
      },
      {
        name: "twinship fuel consumption rate in MT per hr",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twFuelConsumptionRateInMTPerHr",
      },
      {
        name: "twinship fuel consumption total in MT",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twFuelConsumptionTotalInMT",
      },
      {
        name: "twinship fuel flow temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twFuelFlowTemperatureMaxInDegC",
      },
      {
        name: "twinship inlet air pressure max in hPa",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twInletAirPressureMaxInHPa",
      },
      {
        name: "twinship inlet air temperature in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twInletAirTemperatureInDegC",
      },
      {
        name: "twinship inlet air temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twInletAirTemperatureMaxInDegC",
      },
      {
        name: "twinship LT cooling seawater 1 temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twLtCoolingSeawater1TemperatureMaxInDegC",
      },
      {
        name: "twinship LT cooling seawater 2 temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twLtCoolingSeawater2TemperatureMaxInDegC",
      },
      {
        name: "twinship ME cooling water temperature in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twMeCoolingWaterTemperatureInDegC",
      },
      {
        name: "twinship ME cooling water temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twMeCoolingWaterTemperatureMaxInDegC",
      },
      {
        name: "twinship power propulsion total in kW",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twPowerPropulsionTotalInKw",
      },
      {
        name: "twinship scavenger air rec temperature in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twScavengerAirRecTemperatureInDegC",
      },
      {
        name: "twinship scavenger air rec temperature max in degrees C",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twScavengerAirRecTemperatureMaxInDegC",
      },
      {
        name: "twinship shaft power max in kW",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twShaftPowerMaxInKW",
      },
      {
        name: "twinship shaft speed max in rev per min",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twShaftSpeedMaxInRevPerMin",
      },
      {
        name: "twinship shaft torque max in kNm",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twShaftTorqueMaxInKnm",
      },
    ],
    connectedComponents: [
      { id: "Propellers", label: "Propellers", category: "Propeller system" },
      { id: "Wind Towers", label: "Wind Towers", category: "Wind assisted propulsion system" },
      { id: "Base Hull", label: "Base Hull", category: "Hull" },
    ],
  },
  "Wind Towers": {
    title: "Wind Towers",
    titleHref:
      "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#WindAssistedPropulsionSystem",
    tags: ["Wind assisted propulsion system"],
    description:
      "Wind-assisted propulsion system (WASP) such as suction sails or rotor sails that harness wind energy to supplement vessel propulsion. Below are the parameters for the wind assisted propulsion system.",
    parameters: [
      {
        name: "twinship WASP power in kW",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twWASPPowerInKW",
      },
      {
        name: "twinship WASP power reduction efficiency percentage",
        value: "",
        href: "https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#twWASPPowerReductionEfficiencyPercentage",
      },
    ],
    connectedComponents: [
      { id: "Base Hull", label: "Base Hull", category: "Hull" },
      { id: "Engine", label: "Engine", category: "Energy system" },
    ],
  },
};

export function getObjectDetailsForNode(node: ShipTreeNode): ObjectDetails {
  const details = OBJECT_DETAILS_BY_LABEL[node.label];
  if (details) return details;
  return DEFAULT_DETAILS;
}
