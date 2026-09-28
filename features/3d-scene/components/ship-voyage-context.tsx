"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ShipVoyageContextValue = {
  /** The ship is under way; otherwise it lies still on the waves. */
  isTraveling: boolean;
  setIsTraveling: (isTraveling: boolean) => void;
};

const ShipVoyageContext = createContext<ShipVoyageContextValue | null>(null);

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
