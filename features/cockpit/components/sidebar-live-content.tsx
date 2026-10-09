"use client";

import type { Alarm } from "@/features/live-data/live-data-types";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { VoyageSummary } from "../voyage/voyage-summary";
import { AlarmsEventsList } from "./alarms-events-list";
import { LiveNodeReading } from "./live-node-reading";

/** A tree row's live reading, in Live data. */
const renderLiveReading = (node: ShipTreeNode) => <LiveNodeReading label={node.label} />;
/** In the Voyage view: a section's voyage reading, a component's own live one. */
const renderVoyageReading = (node: ShipTreeNode) => <LiveNodeReading label={node.label} isVoyage />;

type View = { isOntologyMode: boolean; isVoyageView: boolean };

/** What the tree's rows show beside their labels: nothing in Ontology, live readings in Live data. */
export function sidebarReadingFor({ isOntologyMode, isVoyageView }: View) {
  if (isOntologyMode) return undefined;
  return isVoyageView ? renderVoyageReading : renderLiveReading;
}

/**
 * Under the tree: nothing in Ontology; the alarms in Live data —
 * under way too, in Voyage, above the voyage's summary.
 */
export function SidebarFooter({
  isOntologyMode,
  isVoyageView,
  onOpenAlarm,
  onOpenLog,
}: View & { onOpenAlarm: (alarm: Alarm) => void; onOpenLog?: () => void }) {
  // The warnings are Live data's: nothing of them in the Ontology
  if (isOntologyMode) return null;
  if (isVoyageView) {
    return (
      <>
        <AlarmsEventsList onOpen={onOpenAlarm} maxHeightClass="max-h-[30vh]" />
        <VoyageSummary />
      </>
    );
  }
  return <AlarmsEventsList onOpen={onOpenAlarm} onOpenLog={onOpenLog} />;
}
