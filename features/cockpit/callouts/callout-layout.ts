import type { CalloutPlacement } from "./callout-config";

/** A rectangle over the scene, in CSS pixels from its top left. */
export type LayoutRect = { x: number; y: number; width: number; height: number };

/** A card to place: its size, its part's anchor, and which side of it it keeps to. */
export type CardToPlace = {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  placement: CalloutPlacement;
  /** The side it was on last frame, kept until its part is well past the ship's middle. */
  previousSide?: "left" | "right";
  /** Its height last frame, keeping its place in the stack until its part is well past another's. */
  previousY?: number;
};

/** Which of two cards goes higher in a stack: by their parts' heights, unless too close to tell, then as last frame. */
function stackOrder(first: CardToPlace, second: CardToPlace) {
  const apart = first.anchor.y - second.anchor.y;
  if (Math.abs(apart) < ORDER_HYSTERESIS && first.previousY !== undefined && second.previousY !== undefined) {
    return first.previousY - second.previousY;
  }
  return apart;
}

/** How far a card sits out from the ship's outline, in CSS pixels. */
const GAP_FROM_SHIP = 28;
/** The least a card sits out from its part, where the ship leaves room nearer. */
const GAP_FROM_PART = 56;
/**
 * How far past the ship's middle a part must be on screen, in CSS pixels, for
 * its card to change side: a part near the middle would flip it every frame.
 */
const SIDE_HYSTERESIS = 60;
/**
 * How far apart two parts' heights must be on screen, in CSS pixels, for
 * their cards to swap places in a side's stack: parts at about the same
 * height, bobbing with the ship, would swap them every frame.
 */
const ORDER_HYSTERESIS = 40;
/**
 * Where a card sits against its part's height: the share of the card above
 * it — mostly above for "above", mostly below for "below".
 */
const SHARE_ABOVE = { above: 0.8, below: 0.2 } as const;
/** Kept clear round the scene's edge. */
const EDGE_MARGIN = 12;
/** Kept between a card and another, or a panel. */
const CLEARANCE = 8;
/**
 * Rounds of placing beside the ship, clearing the panels and stacking the
 * sides: each can undo a little of another.
 */
const SEPARATION_ROUNDS = 3;

function clamp(rect: LayoutRect, bounds: { width: number; height: number }): LayoutRect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, EDGE_MARGIN), Math.max(EDGE_MARGIN, bounds.width - rect.width - EDGE_MARGIN)),
    y: Math.min(Math.max(rect.y, EDGE_MARGIN), Math.max(EDGE_MARGIN, bounds.height - rect.height - EDGE_MARGIN)),
  };
}

/** How far `rect` must move to clear `other`, by the shorter way out; null when they are apart. */
function pushOut(rect: LayoutRect, other: LayoutRect) {
  const right = other.x + other.width + CLEARANCE - rect.x;
  const left = rect.x + rect.width + CLEARANCE - other.x;
  const down = other.y + other.height + CLEARANCE - rect.y;
  const up = rect.y + rect.height + CLEARANCE - other.y;
  if (right <= 0 || left <= 0 || down <= 0 || up <= 0) return null;
  const smallest = Math.min(right, left, down, up);
  if (smallest === right) return { x: right, y: 0 };
  if (smallest === left) return { x: -left, y: 0 };
  if (smallest === down) return { x: 0, y: down };
  return { x: 0, y: -up };
}

/**
 * A side's cards stacked, top to bottom in their parts' order: each at its
 * own height or just under the one above, then the column lifted as a whole
 * if it runs off the scene's foot.
 */
function stackColumn(column: LayoutRect[], bounds: { height: number }) {
  let floor = EDGE_MARGIN;
  for (const rect of column) {
    rect.y = Math.max(rect.y, floor);
    floor = rect.y + rect.height + CLEARANCE;
  }
  let ceiling = bounds.height - EDGE_MARGIN;
  for (const rect of [...column].reverse()) {
    rect.y = Math.max(EDGE_MARGIN, Math.min(rect.y, ceiling - rect.height));
    ceiling = rect.y - CLEARANCE;
  }
}

/**
 * Where a card goes across, at its height: just clear of the ship's outline
 * there — the slices beside it — on its side, and never nearer its part than
 * GAP_FROM_PART. A slanted ship leaves each card its own distance out.
 */
function besideShip(rect: LayoutRect, anchorX: number, side: "left" | "right", slices: LayoutRect[]) {
  const beside = slices.filter((slice) => slice.y < rect.y + rect.height && slice.y + slice.height > rect.y);
  if (side === "right") {
    const edge = Math.max(anchorX + GAP_FROM_PART - GAP_FROM_SHIP, ...beside.map((slice) => slice.x + slice.width));
    return edge + GAP_FROM_SHIP;
  }
  const edge = Math.min(anchorX - GAP_FROM_PART + GAP_FROM_SHIP, ...beside.map((slice) => slice.x));
  return edge - GAP_FROM_SHIP - rect.width;
}

/** A panel this share of the scene's width, near its foot, is a bar the cards stay above. */
const WIDE_PANEL_SHARE = 0.4;
/** How near the foot such a bar must reach, and the gap kept above it, in px. */
const FLOOR_REACH_PX = 40;
const FLOOR_GAP_PX = 8;

/**
 * Where each card goes: at its part's height, out beside the ship's outline
 * on the side nearer the part — each as far out as the ship is wide there,
 * so the ship stays in view — clear of the panels over the scene (`avoid`),
 * each side's cards stacked in their parts' order. Without the outline,
 * beside the part itself.
 */
export function layoutCards(
  cards: CardToPlace[],
  avoid: LayoutRect[],
  bounds: { width: number; height: number },
  shipSlices: LayoutRect[]
) {
  // A bar across the scene's foot (the replay and navigation): the cards' room ends above it, so the
  // stacking cannot push one under it — pushed out of it alone, the next round of stacking undid it
  const floor = Math.min(
    bounds.height,
    ...avoid
      .filter((panel) => panel.width > bounds.width * WIDE_PANEL_SHARE && panel.y + panel.height > bounds.height - FLOOR_REACH_PX)
      .map((panel) => panel.y - FLOOR_GAP_PX)
  );
  bounds = { width: bounds.width, height: floor };
  // The ship's side nearer each part, as the camera has turned it: its own side without the outline
  const left = Math.min(...shipSlices.map((slice) => slice.x));
  const right = Math.max(...shipSlices.map((slice) => slice.x + slice.width));
  const middle = (left + right) / 2;
  const sides = cards.map(({ anchor, placement, previousSide }) => {
    if (shipSlices.length === 0) return placement.side;
    if (previousSide === "left" && anchor.x < middle + SIDE_HYSTERESIS) return "left";
    if (previousSide === "right" && anchor.x > middle - SIDE_HYSTERESIS) return "right";
    return anchor.x < middle ? "left" : "right";
  });
  const placed: LayoutRect[] = cards.map(({ width, height, anchor, placement }) => ({
    x: 0,
    y: anchor.y - height * SHARE_ABOVE[placement.vertical],
    width,
    height,
  }));

  for (let round = 0; round < SEPARATION_ROUNDS; round++) {
    // Beside the ship at its height, then out of the panels by the shorter way
    placed.forEach((rect, index) => {
      rect.x = besideShip(rect, cards[index].anchor.x, sides[index], shipSlices);
      Object.assign(rect, clamp(rect, bounds));
      for (const panel of avoid) {
        const push = pushOut(rect, panel);
        if (push) Object.assign(rect, clamp({ ...rect, x: rect.x + push.x, y: rect.y + push.y }, bounds));
      }
    });
    // Each side's cards one under the other, in their parts' order
    for (const side of ["left", "right"] as const) {
      const column = placed
        .map((rect, index) => ({ rect, card: cards[index], side: sides[index] }))
        .filter((entry) => entry.side === side)
        .sort((first, second) => stackOrder(first.card, second.card))
        .map((entry) => entry.rect);
      stackColumn(column, bounds);
    }
  }
  // Across once more, for the heights the stacking gave them
  placed.forEach((rect, index) => {
    rect.x = clamp({ ...rect, x: besideShip(rect, cards[index].anchor.x, sides[index], shipSlices) }, bounds).x;
  });
  return placed.map((rect, index) => ({ ...rect, side: sides[index] }));
}

/** Share of the way to its new place a card moves in `seconds`: a glide, not a jump. */
export function glideShare(seconds: number, timeConstant: number) {
  return 1 - Math.exp(-seconds / timeConstant);
}
