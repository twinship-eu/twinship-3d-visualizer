"use client";

import { useCallback } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { MOBILE_TAB_PARAM, MOBILE_TABS, type ViewerMode } from "../cockpit-config";
import type { MobileTab } from "../mobile/mobile-tab-bar";

type Navigation = {
  setMode: (mode: ViewerMode) => void;
};

/**
 * The phone's tab: all four in Live data, as the design has the phone — the
 * live view, the components, the log, the assistant. Kept in the URL
 * (`?tab=components`), so coming back from a component's own page (the
 * engine's) opens the tab it was opened from.
 */
export function useMobileTab({ setMode }: Navigation) {
  const [tab, setTabState] = useQueryState(
    MOBILE_TAB_PARAM,
    parseAsStringLiteral(MOBILE_TABS).withDefault("live").withOptions({ history: "replace" })
  );

  const setTab = useCallback(
    (next: MobileTab) => {
      void setTabState(next);
      setMode("live");
    },
    [setMode, setTabState]
  );

  return { tab, setTab };
}
