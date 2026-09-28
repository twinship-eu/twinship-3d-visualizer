"use client";

import { useCallback, useState } from "react";
import type { MobileTab } from "../mobile/mobile-tab-bar";
import type { LiveView, ViewerMode } from "../cockpit-config";

type Navigation = {
  mode: ViewerMode;
  liveView: LiveView;
  setMode: (mode: ViewerMode) => void;
  setLiveView: (view: LiveView) => void;
};

/**
 * The phone's tab, read from the same state as the desktop's switches — Ship
 * is the Ontology, Overview and Voyage the Live data's two views — plus the
 * Alarms tab, the phone's own.
 */
export function useMobileTab({ mode, liveView, setMode, setLiveView }: Navigation) {
  const [isShowingAlarms, setIsShowingAlarms] = useState(false);

  const tab: MobileTab =
    mode === "ontology" ? "ship" : liveView === "voyage" ? "voyage" : isShowingAlarms ? "alarms" : "overview";

  const setTab = useCallback(
    (next: MobileTab) => {
      setIsShowingAlarms(next === "alarms");
      if (next === "ship") {
        setMode("ontology");
        return;
      }
      setMode("live");
      setLiveView(next === "voyage" ? "voyage" : "systems");
    },
    [setMode, setLiveView]
  );

  return { tab, setTab };
}
