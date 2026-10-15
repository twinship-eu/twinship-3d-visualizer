"use client";

import { ChevronLeft } from "lucide-react";
import { AnomalyPanel } from "@/features/anomalies/components/anomaly-panel";
import { closeAnomaly, openAnomaly, useOpenAnomaly } from "@/features/anomalies/lib/anomaly-store";
import { AssistantPanel } from "@/features/assistant/components/assistant-panel";
import { askAssistant } from "@/features/assistant/lib/assistant-store";
import type { Alarm } from "@/features/live-data/live-data-types";
import { MobileComponents, MobileOverview } from "./mobile-overview";
import { MobileLog } from "./mobile-log";
import type { MobileTab } from "./mobile-tab-bar";

type Props = {
  tab: MobileTab;
  onOpenAlarm: (alarm: Alarm) => void;
  onOpenComponent: (label: string) => void;
  onTabChange: (tab: MobileTab) => void;
};

/** Below lg, in Live data: the tab's page under the scene's card. Nothing at lg. */
export function MobileTabContent({ tab, onOpenAlarm, onOpenComponent, onTabChange }: Props) {
  const anomaly = useOpenAnomaly();
  if (tab === "live" && anomaly) {
    // The open anomaly, in the page, with the way back to the overview
    return (
      <div className="flex flex-col lg:hidden">
        <button type="button" onClick={closeAnomaly} className="flex cursor-pointer items-center gap-1 px-4 pt-3 text-sm font-semibold text-accent-ink">
          <ChevronLeft className="size-4" aria-hidden />
          Overview
        </button>
        <AnomalyPanel isPhonePage alarm={anomaly} onAsk={() => onTabChange("ask")} onOpenLog={() => { closeAnomaly(); onTabChange("log"); }} />
      </div>
    );
  }
  if (tab === "live") return <MobileOverview onOpenAlarm={onOpenAlarm} onOpenComponent={onOpenComponent} />;
  if (tab === "components") return <MobileComponents onOpenComponent={onOpenComponent} />;
  if (tab === "log") {
    return (
      <MobileLog
        onOpenAnomaly={(alarmId) => {
          openAnomaly(alarmId);
          onTabChange("live");
        }}
        onAsk={(question) => {
          askAssistant(question);
          onTabChange("ask");
        }}
      />
    );
  }
  return <AssistantPanel isPhonePage onOpenLog={() => onTabChange("log")} onOpenComponent={onOpenComponent} />;
}
