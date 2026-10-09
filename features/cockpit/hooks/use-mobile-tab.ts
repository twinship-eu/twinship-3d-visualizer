"use client";

import { useCallback, useState } from "react";
import type { MobileTab } from "../mobile/mobile-tab-bar";
import type { ViewerMode } from "../cockpit-config";

type Navigation = {
  setMode: (mode: ViewerMode) => void;
};

/**
 * The phone's tab: all four in Live data, as the design has the phone — the
 * live view, the components, the log, the assistant. The phone's own state.
 */
export function useMobileTab({ setMode }: Navigation) {
  const [tab, setTabState] = useState<MobileTab>("live");

  const setTab = useCallback(
    (next: MobileTab) => {
      setTabState(next);
      setMode("live");
    },
    [setMode]
  );

  return { tab, setTab };
}
