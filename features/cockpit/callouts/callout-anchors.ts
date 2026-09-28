import type { CalloutId } from "./callout-config";

/** Where a callout's part of the ship is on screen, in CSS pixels from the scene's top left. */
export type CalloutAnchor = { x: number; y: number; isVisible: boolean };

/**
 * The callouts' anchors, as the projector inside the Canvas last found them:
 * written every frame, read every frame by the overlay. A plain object, not
 * React state — sixty renders a second would be wasted on it.
 */
export const calloutAnchors: Partial<Record<CalloutId, CalloutAnchor>> = {};
