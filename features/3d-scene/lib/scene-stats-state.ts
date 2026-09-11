/**
 * Per-frame render counters, written inside the Canvas and read by the overlay
 * outside it.
 *
 * A shared mutable rather than React state because it changes every frame:
 * routing it through state would re-render the scene at frame rate, which is
 * the opposite of what a performance readout should do. Same reasoning as
 * LOADING_RING_REVEAL.
 */
export const SCENE_STATS = {
  /** Draw calls in the last frame, across every pass. */
  drawCalls: 0,
  /** Triangles rasterised in the last frame, across every pass. */
  triangles: 0,
  /** Geometries currently resident on the GPU. */
  geometries: 0,
  /** Textures currently resident on the GPU. */
  textures: 0,
  /** Compute dispatches in the last frame. */
  computeCalls: 0,
  /** DIAGNOSTIC: highest drawCalls ever observed, never reset. */
  peakDrawCalls: 0,
  /** DIAGNOSTIC: whether three resets the counters itself each frame. */
  autoReset: true,
};
