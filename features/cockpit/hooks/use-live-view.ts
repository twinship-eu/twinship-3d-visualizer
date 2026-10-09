"use client";

import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { CALLOUTS_PARAM, DEFAULT_LIVE_VIEW, IS_NAVIGATION_TOGGLE_ENABLED, LIVE_VIEW_PARAM, LIVE_VIEWS, NAVIGATION_PARAM } from "../cockpit-config";

/**
 * Inside Live data: Systems or Voyage, and whether the callouts are shown.
 * Kept in the URL like the viewer mode; the defaults leave it clean.
 */
export function useLiveView() {
  const [view, setView] = useQueryState(
    LIVE_VIEW_PARAM,
    parseAsStringLiteral(LIVE_VIEWS).withDefault(DEFAULT_LIVE_VIEW).withOptions({ history: "replace" })
  );
  const [isShowingCallouts, setIsShowingCallouts] = useQueryState(
    CALLOUTS_PARAM,
    parseAsBoolean.withDefault(true).withOptions({ history: "replace" })
  );

  const [isNavigationParamOn, setIsShowingNavigation] = useQueryState(
    NAVIGATION_PARAM,
    parseAsBoolean.withDefault(true).withOptions({ history: "replace" })
  );
  // Without its toggle the navigation layer always shows, whatever the URL says
  const isShowingNavigation = !IS_NAVIGATION_TOGGLE_ENABLED || isNavigationParamOn;

  return { view, setView, isShowingCallouts, setIsShowingCallouts, isShowingNavigation, setIsShowingNavigation };
}
