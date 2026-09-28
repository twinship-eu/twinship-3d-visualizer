/**
 * Live data's callouts: a card for a part of the ship, over the
 * scene, with a line to where that part is. Laid out as the cockpit design
 * places them, in shares of the scene's width and height.
 */

export type CalloutId =
  | "bridge"
  | "deck"
  | "waps"
  | "propellers"
  | "engine"
  | "voyageRotors"
  | "voyagePropellers";

/** Where a card sits over the scene: its left or right edge and its top, in % of the scene. */
type CalloutSlot = { leftPct?: number; rightPct?: number; topPct: number };

export type CalloutDefinition = {
  id: CalloutId;
  title: string;
  /** The model object the line points at, by its name in the GLB. */
  objectName: string;
  /** The component the card opens, by its label in the ontology tree. */
  componentLabel: string;
  /** The Tailwind class for its dot: its section's colour. */
  dotClass: string;
  slot: CalloutSlot;
  /** The card's width, in CSS pixels. */
  widthPx: number;
  /** What its header shows on the right: a plain OK, a Normal chip, or nothing. */
  status?: "ok" | "normal";
  /** Whether it links to its component's details. */
  hasDetailsLink?: boolean;
};

/** The Systems view's callouts. */
export const SYSTEMS_CALLOUTS: CalloutDefinition[] = [
  {
    id: "bridge",
    title: "Control room · Radio",
    objectName: "ControlRoom",
    componentLabel: "Control room",
    dotClass: "bg-system-hull",
    slot: { leftPct: 2, topPct: 17 },
    widthPx: 220,
    status: "ok",
  },
  {
    id: "deck",
    title: "Crane · Container",
    objectName: "Crane",
    componentLabel: "Crane",
    dotClass: "bg-system-deck",
    slot: { leftPct: 32, topPct: 28 },
    widthPx: 180,
  },
  {
    id: "waps",
    title: "WAPS · 2 rotor sails",
    objectName: "WindTurbines",
    componentLabel: "WAPS",
    dotClass: "bg-system-hull",
    slot: { rightPct: 10, topPct: 2.5 },
    widthPx: 226,
    status: "ok",
  },
  {
    id: "propellers",
    title: "Propellers",
    objectName: "Propellers",
    componentLabel: "Propellers",
    dotClass: "bg-system-propeller",
    slot: { rightPct: 1.2, topPct: 52 },
    widthPx: 150,
  },
  {
    id: "engine",
    title: "Engine · Main",
    objectName: "Engine",
    componentLabel: "Engine",
    dotClass: "bg-system-energy",
    slot: { rightPct: 14.5, topPct: 64 },
    widthPx: 244,
    status: "normal",
    hasDetailsLink: true,
  },
];

/** The Voyage view's callouts: fewer, smaller, round the instruments. */
export const VOYAGE_CALLOUTS: CalloutDefinition[] = [
  {
    id: "voyageRotors",
    title: "Rotor sails",
    objectName: "WindTurbines",
    componentLabel: "WAPS",
    dotClass: "bg-system-hull",
    slot: { leftPct: 60, topPct: 24 },
    widthPx: 170,
  },
  {
    id: "voyagePropellers",
    title: "Propellers",
    objectName: "Propellers",
    componentLabel: "Propellers",
    dotClass: "bg-system-propeller",
    slot: { leftPct: 13, topPct: 76 },
    widthPx: 250,
  },
];
