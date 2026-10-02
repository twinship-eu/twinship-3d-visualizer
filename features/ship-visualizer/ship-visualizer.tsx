"use client";

import { useState, useCallback } from "react";
import { CockpitTopBar } from "@/features/cockpit/components/cockpit-top-bar";
import { LiveSceneOverlays } from "@/features/cockpit/components/live-scene-layers";
import { SidebarFooter, sidebarReadingFor } from "@/features/cockpit/components/sidebar-live-content";
import { useCockpitPanel } from "@/features/cockpit/hooks/use-cockpit-panel";
import { useCockpitPanels } from "@/features/cockpit/hooks/use-cockpit-panels";
import { useLiveLayout } from "@/features/cockpit/hooks/use-live-layout";
import { ComponentLivePanel } from "@/features/cockpit/component-live/component-live-panel";
import { useLiveView } from "@/features/cockpit/hooks/use-live-view";
import { useMobileTab } from "@/features/cockpit/hooks/use-mobile-tab";
import { useViewerMode } from "@/features/cockpit/hooks/use-viewer-mode";
import { MobileComponentSheet } from "@/features/cockpit/mobile/mobile-component-sheet";
import { MobileHeader } from "@/features/cockpit/mobile/mobile-header";
import { MobileSceneCardChrome, MobileSelectionChrome } from "@/features/cockpit/mobile/mobile-scene-chrome";
import { MobileTabBar } from "@/features/cockpit/mobile/mobile-tab-bar";
import { MobileTabContent } from "@/features/cockpit/mobile/mobile-tab-content";
import type { Alarm } from "@/features/live-data/live-data-types";
import { SceneBottomStrip } from "./components/scene-bottom-strip";
import { ShipScene } from "./components/ship-scene";
import { SelectionDetailsModal } from "./components/selection-details-modal";
import { ShipSidebar } from "./components/ship-sidebar";
import { useEscapeKey } from "./hooks/use-escape-key";
import { useShipModel } from "./hooks/use-ship-model";
import { findNodeByLabel } from "./lib/filter-tree";
import { isNodeInNonSelectableSection } from "./lib/map-tree-to-sections";
import { sceneBoxClass, sceneColumnClass } from "./lib/scene-layout-classes";
import type { ShipTreeNode } from "./ship-visualizer-types";

export function ShipVisualizer() {
  const { mode, setMode } = useViewerMode();
  const liveView = useLiveView();
  const mobile = useMobileTab({
    mode,
    liveView: liveView.view,
    setMode: (next) => void setMode(next),
    setLiveView: (next) => void liveView.setView(next),
  });
  /** Below lg: the scene's card opened full screen. */
  const [isSceneExpanded, setIsSceneExpanded] = useState(false);
  /** Below lg: the open component's alarm shown in its sheet, rather than its readings. */
  const [isShowingMobileAlarm, setIsShowingMobileAlarm] = useState(false);
  /**
   * Only meaningful below `lg`, where the sidebar is an overlay. At `lg` and
   * above the panel is statically docked and this is ignored.
   */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  /** Whether the details sheet is at its tall height. Below lg only. */
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [selectedStructureNode, setSelectedStructureNode] =
    useState<ShipTreeNode | null>(null);
  const [hoveredStructureNode, setHoveredStructureNode] =
    useState<ShipTreeNode | null>(null);
  // A new model's tree: nothing in it is selected yet
  const model = useShipModel(
    useCallback(() => setSelectedStructureNode(null), [])
  );
  const { tree, isModelReady } = model;

  // Escape closes the overlay tree first, then deselects
  useEscapeKey(
    useCallback(() => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return;
      }
      setSelectedStructureNode(null);
      setIsDetailsExpanded(false);
    }, [isSidebarOpen])
  );

  const { setModelPath } = model;
  const handleSelectNode = useCallback((node: ShipTreeNode) => {
    if (node.modelPath) {
      setModelPath(node.modelPath);
      return;
    }
    if (isNodeInNonSelectableSection(node)) return;
    setSelectedStructureNode((prev) => (prev?.id === node.id ? null : node));
  }, [setModelPath]);

  const handleHover = useCallback((node: ShipTreeNode | null) => {
    setHoveredStructureNode(node);
  }, []);

  const handleSelectByClick = useCallback((node: ShipTreeNode | null) => {
    setSelectedStructureNode(node);
  }, []);

  const handleSelectConnectedComponent = useCallback(
    (targetLabel: string) => {
      const targetNode = findNodeByLabel(tree, targetLabel);
      if (!targetNode) return;
      if (isNodeInNonSelectableSection(targetNode)) return;
      setSelectedStructureNode(targetNode);
    },
    [tree]
  );

  /** A warning's component, opened in Live data. */
  const handleOpenAlarm = useCallback(
    (alarm: Alarm) => {
      void setMode("live");
      const componentNode = findNodeByLabel(tree, alarm.componentLabel);
      if (componentNode && !isNodeInNonSelectableSection(componentNode)) {
        setSelectedStructureNode(componentNode);
        setIsShowingMobileAlarm(true);
      }
    },
    [tree, setMode]
  );

  const {
    isOntologyMode,
    liveSelection: componentLiveSelection,
    isVoyageView,
    liveSelectionSection,
    callouts,
    isMobileCard,
  } = useLiveLayout({
    mode,
    liveView: liveView.view,
    isShowingCallouts: liveView.isShowingCallouts,
    selectedNode: selectedStructureNode,
    isModelReady,
  });
  // With the event log open the ship is focused by the log, not opened in a component's panel
  const { panel: openPanelParam } = useCockpitPanel();
  const isLogOpen = !isOntologyMode && openPanelParam === "log";
  const liveSelection = isLogOpen ? null : componentLiveSelection;
  const clearSelection = () => {
    setSelectedStructureNode(null);
    setIsDetailsExpanded(false);
    setIsShowingMobileAlarm(false);
  };
  const liveReading = sidebarReadingFor({ isOntologyMode, isVoyageView });
  // The event log over the scene, the assistant beside it: in Live data
  const panels = useCockpitPanels({
    isOntologyMode,
    onOpenComponent: handleSelectConnectedComponent,
    onClearSelection: clearSelection,
    renderReading: liveReading,
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CockpitTopBar
        mode={mode}
        onModeChange={(next) => void setMode(next)}
        onOpenAlarm={handleOpenAlarm}
        panel={panels.panel}
        onPanelChange={panels.changePanel}
      />
      {liveSelection === null && <MobileHeader />}
      <div className="relative flex min-h-0 w-full flex-1 gap-0">
        <ShipSidebar
          isOpen={isSidebarOpen}
          // Below lg the tree is the Ship tab's: behind its button
          hasToggle={isOntologyMode}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
          tree={tree}
          isLoading={!isModelReady}
          visibleNodeIds={model.visibleNodeIds}
          onToggleSectionVisible={model.setSectionVisible}
          onSelect={panels.sidebar?.onSelect ?? handleSelectNode}
          selectedNodeId={selectedStructureNode?.id ?? null}
          footer={
            panels.sidebar?.footer ?? (
              <SidebarFooter isOntologyMode={isOntologyMode} isVoyageView={isVoyageView} onOpenAlarm={handleOpenAlarm} />
            )
          }
          renderReading={panels.sidebar?.renderReading ?? liveReading}
        />
        <div
          className={sceneColumnClass({
            isOntologyMode,
            hasSelection: selectedStructureNode !== null,
            isDetailsExpanded,
            hasLiveSelection: liveSelection !== null,
            isMobileCard,
          })}
        >
          <div
            className={sceneBoxClass({ isMobileCard, isSceneExpanded })}
          >
            <ShipScene
              model={model}
              selectedNode={selectedStructureNode}
              hoveredNode={hoveredStructureNode}
              onHover={handleHover}
              onSelectByClick={handleSelectByClick}
              live={
                isOntologyMode
                  ? null
                  : { view: liveView.view, isVoyageView, callouts: panels.hidesCallouts ? null : callouts, liveSelection }
              }
              // No zoom controls on the phone's card, nor under a component's sheet
              isCompactBelowLg={
                (isMobileCard && !isSceneExpanded) || liveSelection !== null
              }
            />
            {!isOntologyMode && (
              <LiveSceneOverlays
                callouts={panels.hidesCallouts ? null : callouts}
                view={liveView.view}
                liveSelection={liveSelection}
                sectionLabel={liveSelectionSection?.label}
                isShowingCallouts={liveView.isShowingCallouts}
                onViewChange={(view) => void liveView.setView(view)}
                onShowCalloutsChange={(isShowing) =>
                  void liveView.setIsShowingCallouts(isShowing)
                }
                onOpenComponent={handleSelectConnectedComponent}
                onOverview={clearSelection}
              />
            )}
            {panels.logScene}
            {isMobileCard && (
              <MobileSceneCardChrome
                isExpanded={isSceneExpanded}
                onToggleExpanded={() => setIsSceneExpanded((open) => !open)}
              />
            )}
            {liveSelection && (
              <MobileSelectionChrome
                componentLabel={liveSelection.label}
                isShowingAlarm={isShowingMobileAlarm}
                onBack={() =>
                  isShowingMobileAlarm
                    ? setIsShowingMobileAlarm(false)
                    : clearSelection()
                }
              />
            )}
            {isOntologyMode && (
              <SelectionDetailsModal
                // A new card for each component: it opens scrolled to its top
                key={selectedStructureNode?.id}
                selectedNode={selectedStructureNode}
                isExpanded={isDetailsExpanded}
                onToggleExpanded={() => setIsDetailsExpanded((open) => !open)}
                onClose={clearSelection}
                onSelectConnectedComponent={handleSelectConnectedComponent}
              />
            )}
          </div>
          {isMobileCard && (
            <MobileTabContent
              tab={mobile.tab}
              onOpenAlarm={handleOpenAlarm}
              onOpenComponent={(label) => {
                handleSelectConnectedComponent(label);
                setIsShowingMobileAlarm(false);
              }}
            />
          )}
          {panels.evidenceStrip ?? (
            <SceneBottomStrip
              isOntologyMode={isOntologyMode}
              isVoyageView={isVoyageView}
              selectedNode={selectedStructureNode}
            />
          )}
        </div>
        {!liveSelection && panels.assistantPanel}
        {panels.logPanel}
        {liveSelection && (
          <ComponentLivePanel
            key={`panel-${liveSelection.id}`}
            node={liveSelection}
            onClose={clearSelection}
            onSelectRelated={handleSelectConnectedComponent}
            onOpenInOntology={() => void setMode("ontology")}
          />
        )}
        {liveSelection && (
          <MobileComponentSheet
            key={`sheet-${liveSelection.id}`}
            node={liveSelection}
            sectionLabel={liveSelectionSection?.label}
            isShowingAlarm={isShowingMobileAlarm}
            onShowAlarm={setIsShowingMobileAlarm}
            onSelectRelated={handleSelectConnectedComponent}
          />
        )}
      </div>
      {selectedStructureNode === null && (
        <MobileTabBar
          tab={mobile.tab}
          onChange={(tab) => {
            clearSelection();
            setIsSceneExpanded(false);
            mobile.setTab(tab);
          }}
        />
      )}
    </div>
  );
}
