"use client";

import { Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveData } from "@/features/live-data/hooks/use-live-data";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import { COCKPIT_BRAND, type ViewerMode } from "../cockpit-config";
import { ThemeToggle } from "../components/theme-toggle";

/** Knots above which the ship reads as under way. */
const UNDERWAY_SPEED_KN = 0.5;
/** The ship model's maker, after "Ship model" in the Ontology's line. */
const SHIP_DESIGNER = COCKPIT_BRAND.subtitle.split(" · ")[0];

type Props = {
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
};

const SEGMENT_CLASS =
  "flex h-[30px] cursor-pointer items-center gap-1 rounded-md px-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The phone's switch between the static ontology and the ship's live data: the top bar's, compact. */
function MobileModeSwitch({ mode, onModeChange }: Props) {
  const segmentClass = (isActive: boolean) =>
    cn(SEGMENT_CLASS, isActive ? "bg-seg-on font-semibold text-seg-on-ink shadow-[0_1px_2px_rgba(2,8,23,0.15)]" : "font-medium text-seg-off");

  return (
    <div role="group" aria-label="Viewer mode" className="flex shrink-0 gap-0.5 rounded-[9px] border border-line bg-seg p-[3px]">
      <button type="button" aria-pressed={mode === "ontology"} onClick={() => onModeChange("ontology")} className={segmentClass(mode === "ontology")}>
        <Network className="size-3.5" aria-hidden />
        Ontology
      </button>
      <button type="button" aria-pressed={mode === "live"} onClick={() => onModeChange("live")} className={segmentClass(mode === "live")}>
        <span className="size-2 rounded-full bg-ok" aria-hidden />
        Live
      </button>
    </div>
  );
}

/**
 * Below lg, over the tabs' pages: the vessel and the switch between the
 * ontology and the live data. Under the name, in the Ontology, the ship
 * model's maker; in Live data how it sails and the data's clock.
 */
export function MobileHeader({ mode, onModeChange }: Props) {
  const snapshot = useLiveData();
  const isUnderway = (snapshot?.navigation.speedOverGroundKn ?? 0) > UNDERWAY_SPEED_KN;

  return (
    <header className="flex shrink-0 items-center gap-2 bg-canvas px-4 pt-3 pb-2 lg:hidden">
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-lg font-bold">TwinShip VESSEL</span>
        <span className="truncate text-[13px] text-muted">
          {mode === "ontology" ? (
            `Ship model · ${SHIP_DESIGNER}`
          ) : (
            <>
              {isUnderway ? "Underway" : "Stopped"}
              {snapshot && (
                <>
                  {` · ${snapshot.autonomyLevel} · `}
                  <span className="font-mono" title="UTC">
                    {formatUtcTime(snapshot.timestamp).slice(0, 5)}
                  </span>
                </>
              )}
            </>
          )}
        </span>
      </div>
      <MobileModeSwitch mode={mode} onModeChange={onModeChange} />
      <ThemeToggle />
    </header>
  );
}
