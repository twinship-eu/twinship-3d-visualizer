"use client";

import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { CALLOUTS_PARAM, DEFAULT_LIVE_VIEW, LIVE_VIEW_PARAM, LIVE_VIEWS } from "../cockpit-config";

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

  return { view, setView, isShowingCallouts, setIsShowingCallouts };
}
