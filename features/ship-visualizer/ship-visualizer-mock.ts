import type { ShipTreeNode } from "./ship-visualizer-types";
import { SHIP_MODEL_JOINED, SHIP_MODEL_V4, SHIP_MODEL_V4_SOLAR } from "./ship-visualizer-config";

export const MOCK_SHIP_TREE: ShipTreeNode[] = [
  {
    id: "ship-model",
    label: "Ship model",
    children: [
      { id: "model-v4", label: "TwinShip V4", modelPath: SHIP_MODEL_V4 },
      { id: "model-v4-solar", label: "TwinShip V4 Solar", modelPath: SHIP_MODEL_V4_SOLAR },
      { id: "model-joined", label: "TwinShip V4 Joined", modelPath: SHIP_MODEL_JOINED },

    ],
  },
  {
    id: "hull",
    label: "Hull",
    children: [
      { id: "hull-bow", label: "Bow" },
      { id: "hull-stern", label: "Stern" },
      { id: "hull-port", label: "Port side" },
      { id: "hull-starboard", label: "Starboard side" },
    ],
  },
  {
    id: "superstructure",
    label: "Superstructure",
    children: [
      { id: "super-bridge", label: "Bridge" },
      { id: "super-funnel", label: "Funnel" },
      { id: "super-accommodation", label: "Accommodation" },
    ],
  },
  {
    id: "deck",
    label: "Deck equipment",
    children: [
      { id: "deck-crane", label: "Crane" },
      { id: "deck-hatch", label: "Hatch covers" },
      { id: "deck-mooring", label: "Mooring equipment" },
    ],
  },
  {
    id: "propulsion",
    label: "Propulsion",
    children: [
      { id: "prop-engine", label: "Main engine" },
      { id: "prop-propeller", label: "Propeller" },
      { id: "prop-rudder", label: "Rudder" },
    ],
  },
];
