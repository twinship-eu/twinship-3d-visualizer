import type { CalloutPlacement } from "./callout-config";

/** A rectangle over the scene, in CSS pixels from its top left. */
export type LayoutRect = { x: number; y: number; width: number; height: number };

/** A card to place: its size, its part's anchor, and which side of it it keeps to. */
export type CardToPlace = {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  placement: CalloutPlacement;
};

/** How far a card sits from its part's anchor: across, and up or down, in CSS pixels. */
const GAP_X = 48;
const GAP_Y = 28;
/** Kept clear round the scene's edge. */
const EDGE_MARGIN = 12;
/** Kept between a card and another, or a panel. */
const CLEARANCE = 8;
/** Rounds of pushing cards apart: few cards, so a few rounds settle them. */
const SEPARATION_ROUNDS = 4;

function clamp(rect: LayoutRect, bounds: { width: number; height: number }): LayoutRect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, EDGE_MARGIN), Math.max(EDGE_MARGIN, bounds.width - rect.width - EDGE_MARGIN)),
    y: Math.min(Math.max(rect.y, EDGE_MARGIN), Math.max(EDGE_MARGIN, bounds.height - rect.height - EDGE_MARGIN)),
  };
}

/**
 * How far `rect` must move to clear `other`, by the shorter way out; null
 * when they are apart.
 */
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
 * Where each card goes: beside its part's anchor, on the side it keeps to,
 * then inside the scene, clear of the panels over it (`avoid`) and of the
 * cards placed before it.
 */
export function layoutCards(cards: CardToPlace[], avoid: LayoutRect[], bounds: { width: number; height: number }) {
  const placed = cards.map(({ width, height, anchor, placement }) =>
    clamp(
      {
        x: placement.side === "right" ? anchor.x + GAP_X : anchor.x - GAP_X - width,
        y: placement.vertical === "below" ? anchor.y + GAP_Y : anchor.y - GAP_Y - height,
        width,
        height,
      },
      bounds
    )
  );

  for (let round = 0; round < SEPARATION_ROUNDS; round++) {
    placed.forEach((_, index) => {
      for (const other of [...avoid, ...placed.slice(0, index)]) {
        const push = pushOut(placed[index], other);
        if (push) placed[index] = clamp({ ...placed[index], x: placed[index].x + push.x, y: placed[index].y + push.y }, bounds);
      }
    });
  }
  return placed;
}

/** Share of the way to its new place a card moves in `seconds`: a glide, not a jump. */
export function glideShare(seconds: number, timeConstant: number) {
  return 1 - Math.exp(-seconds / timeConstant);
}
