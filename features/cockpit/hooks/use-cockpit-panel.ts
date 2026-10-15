"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { COCKPIT_PANELS, LOG_SYSTEM_PARAM, PANEL_PARAM } from "../cockpit-config";

/**
 * Which panel Live data has open — the event log, the assistant, or none —
 * and the log's system filter. In the URL, so a view can be shared.
 */
export function useCockpitPanel() {
  const [panel, setPanel] = useQueryState(PANEL_PARAM, parseAsStringLiteral(COCKPIT_PANELS).withOptions({ history: "replace" }));
  const [logSystem, setLogSystem] = useQueryState(LOG_SYSTEM_PARAM, parseAsString.withOptions({ history: "replace" }));
  return { panel, setPanel, logSystem, setLogSystem };
}
