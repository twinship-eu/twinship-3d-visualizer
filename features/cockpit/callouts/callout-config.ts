/**
 * Live data's callouts: a card for a part of the ship, over the scene, with
 * a line to where that part is. Each card keeps beside its part as the camera
 * turns, on the side the cockpit design places it (see `callout-layout.ts`).
 */

export type CalloutId =
  | "bridge"
  | "deck"
  | "waps"
  | "propellers"
  | "engine"
  | "voyageSails"
  | "voyagePropellers";

/**
 * The model's objects whose outline is the ship's on screen — hull, towers,
 * sails, bridge: the cards keep outside it, so the ship stays in view.
 */
export const SHIP_OUTLINE_OBJECT_NAMES = ["Base", "Base_Top", "WindTurbines", "ControlRoom"] as const;

/**
 * Whether a card sits a little above or below its part's height, and which
 * side it keeps to before the ship's outline is known (then it is the side
 * nearer its part).
 */
export type CalloutPlacement = { side: "left" | "right"; vertical: "above" | "below" };

export type CalloutDefinition = {
  id: CalloutId;
  title: string;
  /** The model object the line points at, by its name in the GLB. */
  objectName: string;
  /** The component the card opens, by its label in the ontology tree. */
  componentLabel: string;
  /** The Tailwind class for its dot: its section's colour. */
  dotClass: string;
  placement: CalloutPlacement;
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
    placement: { side: "left", vertical: "above" },
    widthPx: 220,
    status: "ok",
  },
  {
    id: "deck",
    title: "Crane · Container",
    objectName: "Crane",
    componentLabel: "Crane",
    dotClass: "bg-system-deck",
    placement: { side: "left", vertical: "above" },
    widthPx: 180,
  },
  {
    id: "waps",
    title: "WAPS · 2 suction sails",
    objectName: "WindTurbines",
    componentLabel: "WAPS",
    dotClass: "bg-system-hull",
    placement: { side: "right", vertical: "above" },
    widthPx: 226,
    status: "ok",
  },
  {
    id: "propellers",
    title: "Propellers",
    objectName: "Propellers",
    componentLabel: "Propellers",
    dotClass: "bg-system-propeller",
    placement: { side: "right", vertical: "above" },
    widthPx: 150,
  },
  {
    id: "engine",
    title: "Engine · Gensets",
    objectName: "Engine",
    componentLabel: "Engine",
    dotClass: "bg-system-energy",
    placement: { side: "right", vertical: "below" },
    widthPx: 244,
    status: "normal",
    hasDetailsLink: true,
  },
];

/** The Voyage view's callouts: fewer, smaller, round the instruments. */
export const VOYAGE_CALLOUTS: CalloutDefinition[] = [
  {
    id: "voyageSails",
    title: "Suction sails",
    objectName: "WindTurbines",
    componentLabel: "WAPS",
    dotClass: "bg-system-hull",
    placement: { side: "right", vertical: "above" },
    widthPx: 170,
  },
  {
    id: "voyagePropellers",
    title: "Propellers",
    objectName: "Propellers",
    componentLabel: "Propellers",
    dotClass: "bg-system-propeller",
    placement: { side: "left", vertical: "below" },
    widthPx: 250,
  },
];
