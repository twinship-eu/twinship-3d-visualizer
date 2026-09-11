"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Tells a click handler whether the gesture that produced it was a drag.
 *
 * Three things here are load-bearing, and each was a separate bug in the
 * version this replaces:
 *
 * 1. **The flag is reset on pointerdown, never on pointerup.** Browsers fire
 *    `pointerdown → pointermove → pointerup → click`, so anything cleared on
 *    pointerup is already false by the time the click handler reads it. That
 *    made the previous guard dead code.
 * 2. **It listens on `window`, not on an object.** R3F's pointer events are
 *    raycast against meshes, so they stop firing the moment the pointer leaves
 *    the object — which is exactly what happens when orbiting swings the model
 *    out from under the cursor mid-gesture.
 * 3. **It listens in the capture phase**, so movement is seen before
 *    OrbitControls or anything else can stop propagation.
 *
 * Returns a getter rather than state on purpose: nothing should re-render when
 * a drag starts.
 */
export function usePointerDragGuard(thresholdPx: number) {
  const isPointerDownRef = useRef(false);
  const didDragRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleDown = (event: PointerEvent) => {
      isPointerDownRef.current = true;
      didDragRef.current = false;
      originRef.current = { x: event.clientX, y: event.clientY };
    };

    const handleMove = (event: PointerEvent) => {
      if (!isPointerDownRef.current || didDragRef.current) return;
      const dx = event.clientX - originRef.current.x;
      const dy = event.clientY - originRef.current.y;
      if (Math.hypot(dx, dy) > thresholdPx) didDragRef.current = true;
    };

    // Deliberately does not clear didDrag: the click that follows still has to
    // be able to see it.
    const handleUp = () => {
      isPointerDownRef.current = false;
    };

    window.addEventListener("pointerdown", handleDown, true);
    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("pointerup", handleUp, true);
    window.addEventListener("pointercancel", handleUp, true);

    return () => {
      window.removeEventListener("pointerdown", handleDown, true);
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", handleUp, true);
      window.removeEventListener("pointercancel", handleUp, true);
    };
  }, [thresholdPx]);

  /** True when the current or most recent gesture moved past the threshold. */
  const getDidDrag = useCallback(() => didDragRef.current, []);

  return { getDidDrag };
}
