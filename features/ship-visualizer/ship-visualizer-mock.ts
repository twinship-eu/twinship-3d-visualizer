import { DEFAULT_SHIP_MODEL_PATH } from "./ship-visualizer-config";
import type { ShipTreeNode } from "./ship-visualizer-types";

export const MOCK_SHIP_TREE: ShipTreeNode[] = [
  {
    id: "ship-model",
    label: "Ship model",
    children: [
      { id: "model-joined", label: "TwinShip VESSEL", modelPath: DEFAULT_SHIP_MODEL_PATH },

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
