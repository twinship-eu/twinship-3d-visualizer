"use client";

import type { Alarm } from "@/features/live-data/live-data-types";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";
import { VoyageSummary } from "../voyage/voyage-summary";
import { AlarmsEventsList } from "./alarms-events-list";
import { LiveNodeReading } from "./live-node-reading";
import { LiveWarningCard } from "./live-warning-card";

/** A tree row's live reading, in Live data. */
const renderLiveReading = (node: ShipTreeNode) => <LiveNodeReading label={node.label} />;
/** A section's reading, in the Voyage view's tree of sections. */
const renderVoyageReading = (node: ShipTreeNode) => <LiveNodeReading label={node.label} isVoyage />;

type View = { isOntologyMode: boolean; isVoyageView: boolean };

/** What the tree's rows show beside their labels: nothing in Ontology, live readings in Live data. */
export function sidebarReadingFor({ isOntologyMode, isVoyageView }: View) {
  if (isOntologyMode) return undefined;
  return isVoyageView ? renderVoyageReading : renderLiveReading;
}

/** Under the tree: the live warning in Ontology, the voyage in Voyage, the alarms in Systems. */
export function SidebarFooter({ isOntologyMode, isVoyageView, onOpenAlarm }: View & { onOpenAlarm: (alarm: Alarm) => void }) {
  if (isOntologyMode) return <LiveWarningCard onOpen={onOpenAlarm} />;
  if (isVoyageView) return <VoyageSummary />;
  return <AlarmsEventsList onOpen={onOpenAlarm} />;
}
