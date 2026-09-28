/**
 * The Systems view's callouts: a card for a part of the ship, over the
 * scene, with a line to where that part is. Laid out as the cockpit design
 * places them, in shares of the scene's width and height.
 */

export type CalloutId = "bridge" | "deck" | "waps" | "propellers" | "engine";

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
};

export const CALLOUTS: CalloutDefinition[] = [
  {
    id: "bridge",
    title: "Control room · Radio",
    objectName: "ControlRoom",
    componentLabel: "Control room",
    dotClass: "bg-system-hull",
    slot: { leftPct: 2, topPct: 17 },
    widthPx: 220,
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
  },
];
