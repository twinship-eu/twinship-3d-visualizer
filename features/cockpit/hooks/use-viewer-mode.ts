"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { DEFAULT_VIEWER_MODE, VIEWER_MODE_PARAM, VIEWER_MODES } from "../cockpit-config";

/**
 * Ontology or Live data: kept in the URL (`?view=live`), so a link or a reload
 * opens the same view. The default, ontology, leaves the URL clean.
 */
export function useViewerMode() {
  const [mode, setMode] = useQueryState(
    VIEWER_MODE_PARAM,
    parseAsStringLiteral(VIEWER_MODES).withDefault(DEFAULT_VIEWER_MODE).withOptions({ history: "replace" })
  );

  return { mode, setMode };
}
