"use client";

import type { Alarm } from "@/features/live-data/live-data-types";
import { MobileOverview } from "./mobile-overview";
import type { MobileTab } from "./mobile-tab-bar";
import { MobileAlarms, MobileVoyage } from "./mobile-tab-pages";

type Props = {
  tab: MobileTab;
  onOpenAlarm: (alarm: Alarm) => void;
  onOpenComponent: (label: string) => void;
};

/** Below lg, in Live data: the tab's page under the scene's card. Nothing at lg, or in the Ship tab. */
export function MobileTabContent({ tab, onOpenAlarm, onOpenComponent }: Props) {
  if (tab === "overview") return <MobileOverview onOpenAlarm={onOpenAlarm} onOpenComponent={onOpenComponent} />;
  if (tab === "voyage") return <MobileVoyage />;
  if (tab === "alarms") return <MobileAlarms onOpen={onOpenAlarm} />;
  return null;
}
