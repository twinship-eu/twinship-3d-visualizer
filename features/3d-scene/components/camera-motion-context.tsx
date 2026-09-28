"use client";

import { createContext, useContext, useMemo, useState } from "react";

type CameraMotionContextValue = {
  /** The camera rides the ship as if mounted on it: its heave, pitch and roll. */
  isRidingShip: boolean;
  setIsRidingShip: (isRidingShip: boolean) => void;
};

const CameraMotionContext = createContext<CameraMotionContextValue | null>(null);

/**
 * Holds whether the camera rides the ship, for the button beside the zoom
 * controls (outside the Canvas) and the camera itself (inside it).
 */
export function CameraMotionProvider({ children }: { children: React.ReactNode }) {
  const [isRidingShip, setIsRidingShip] = useState(false);
  const value = useMemo(() => ({ isRidingShip, setIsRidingShip }), [isRidingShip]);

  return <CameraMotionContext.Provider value={value}>{children}</CameraMotionContext.Provider>;
}

export function useCameraMotion(): CameraMotionContextValue {
  const context = useContext(CameraMotionContext);
  if (context === null) throw new Error("useCameraMotion must be used inside a CameraMotionProvider");

  return context;
}
