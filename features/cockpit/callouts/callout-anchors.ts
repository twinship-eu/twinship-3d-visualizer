import type { CalloutId } from "./callout-config";

/** Where a callout's part of the ship is on screen, in CSS pixels from the scene's top left. */
export type CalloutAnchor = { x: number; y: number; isVisible: boolean };

/**
 * The callouts' anchors, as the projector inside the Canvas last found them:
 * written every frame, read every frame by the overlay. A plain object, not
 * React state — sixty renders a second would be wasted on it.
 */
export const calloutAnchors: Partial<Record<CalloutId, CalloutAnchor>> = {};

/**
 * Where the ship is on screen: its outline, as the rectangles round slices of
 * it, in CSS pixels; empty before it is found.
 */
export const shipOutline: { slices: { x: number; y: number; width: number; height: number }[] } = { slices: [] };

const anchorListeners = new Set<() => void>();

/**
 * Calls `listener` each time the projectors have written the anchors — in
 * the same frame, just before it is drawn, so the lines never trail the
 * scene by a frame. Returns what unsubscribes it.
 */
export function subscribeToAnchors(listener: () => void) {
  anchorListeners.add(listener);
  return () => {
    anchorListeners.delete(listener);
  };
}

/** Tells the overlays the anchors are written: the projectors' last step each frame. */
export function publishAnchors() {
  anchorListeners.forEach((listener) => listener());
}
