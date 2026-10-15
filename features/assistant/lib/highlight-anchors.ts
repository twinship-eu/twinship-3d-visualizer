/** Where each highlighted component is on screen, in CSS pixels from the scene's top left, by its label. */
export const highlightAnchors: Record<string, { x: number; y: number; isVisible: boolean }> = {};

const listeners = new Set<() => void>();

/** Calls `listener` each frame the projector has placed the highlights; returns what unsubscribes it. */
export function subscribeToHighlightAnchors(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishHighlightAnchors() {
  listeners.forEach((listener) => listener());
}
