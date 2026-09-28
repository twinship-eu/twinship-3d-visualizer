"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ShipVoyageContextValue = {
  /** The ship is under way; otherwise it lies still on the waves. */
  isTraveling: boolean;
  setIsTraveling: (isTraveling: boolean) => void;
};

const ShipVoyageContext = createContext<ShipVoyageContextValue | null>(null);

/**
 * The speed the ship sails at under way, in knots, when something outside
 * the scene sets it — the ship's live speed over ground, in Live data. Null
 * for the sea's own default. Read every frame, so a plain object rather than
 * React state: setting it re-renders nothing.
 */
export const shipSpeedOverride: { knots: number | null } = { knots: null };

/**
 * Holds whether the ship is under way, for the button beside the zoom controls
 * (outside the Canvas) and the sea (inside it). It starts still.
 */
export function ShipVoyageProvider({ children }: { children: React.ReactNode }) {
  const [isTraveling, setIsTraveling] = useState(false);
  const value = useMemo(() => ({ isTraveling, setIsTraveling }), [isTraveling]);

  return <ShipVoyageContext.Provider value={value}>{children}</ShipVoyageContext.Provider>;
}

export function useShipVoyage(): ShipVoyageContextValue {
  const context = useContext(ShipVoyageContext);
  if (context === null) throw new Error("useShipVoyage must be used inside a ShipVoyageProvider");

  return context;
}
