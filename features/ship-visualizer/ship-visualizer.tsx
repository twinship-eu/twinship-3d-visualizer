"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Scene } from "@/features/3d-scene/3d-scene";
import { SceneErrorFallback } from "./components/scene-error-fallback";
import Ship from "./components/scene-content";
import { MOCK_SHIP_TREE } from "./ship-visualizer-mock";
import {
  isNodeInNonSelectableSection,
  mapModelTreeToSections,
} from "./lib/map-tree-to-sections";
import { collectNodeIds, findNodeByLabel } from "./lib/filter-tree";
import {
  SIDEBAR_WIDTH_CLASS,
  DEFAULT_SHIP_MODEL_PATH,
} from "./ship-visualizer-config";
import { SidebarToggleButton } from "./components/sidebar-toggle-button";
import { cn } from "@/lib/utils";
import type { ShipTreeNode } from "./ship-visualizer-types";
import { OntologyExplorer } from "../ontology-explorrer/ontology-explorer";
import { SelectionDetailsModal } from "./components/selection-details-modal";
import { LoadingRing } from "@/features/3d-scene/components/loading-ring";
import { useModelLoadProgress } from "./hooks/use-model-load-progress";
import { OntologyRelationsStrip } from "./components/ontology-relations-strip";
import { CockpitTopBar } from "@/features/cockpit/components/cockpit-top-bar";
import { LiveWarningCard } from "@/features/cockpit/components/live-warning-card";
import { useViewerMode } from "@/features/cockpit/hooks/use-viewer-mode";
import { useLiveView } from "@/features/cockpit/hooks/use-live-view";
import { AlarmsEventsList } from "@/features/cockpit/components/alarms-events-list";
import { LiveNodeReading } from "@/features/cockpit/components/live-node-reading";
import { LiveViewControls } from "@/features/cockpit/components/live-view-controls";
import { SystemCardsStrip } from "@/features/cockpit/components/system-cards-strip";
import { CalloutAnchorProjector } from "@/features/cockpit/callouts/callout-anchor-projector";
import { SystemCallouts } from "@/features/cockpit/callouts/system-callouts";
import type { Alarm } from "@/features/live-data/live-data-types";

const SHIP_MODEL_SECTION = MOCK_SHIP_TREE[0];

/** A tree row's live reading, in Live data. */
const renderLiveReading = (node: ShipTreeNode) => (
  <LiveNodeReading label={node.label} />
);

export function ShipVisualizer() {
  const { mode, setMode } = useViewerMode();
  const liveView = useLiveView();
  const [selectedModelPath, setSelectedModelPath] = useState(
    DEFAULT_SHIP_MODEL_PATH
  );
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
  const [modelTree, setModelTree] = useState<ShipTreeNode[] | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Record<string, boolean>>(
    {}
  );
  const isModelReady = modelTree !== null;
  const [assemblyTargets, setAssemblyTargets] = useState<Float32Array | null>(
    null
  );
  const loading = useModelLoadProgress(isModelReady, assemblyTargets !== null);

  const renderedModelPath = selectedModelPath;

  useEffect(() => {
    setModelTree(null);
  }, [renderedModelPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return;
      }
      if (selectedStructureNode !== null) {
        setSelectedStructureNode(null);
        setIsDetailsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStructureNode, isSidebarOpen]);

  const handleModelTreeLoaded = useCallback((tree: ShipTreeNode[]) => {
    const topLevelOnly = tree.map((node) => ({
      ...node,
      children: undefined,
    }));
    const sectioned = mapModelTreeToSections(topLevelOnly);
    setModelTree([SHIP_MODEL_SECTION, ...sectioned]);
    setSelectedStructureNode(null);
  }, []);

  const handleSelectNode = useCallback((node: ShipTreeNode) => {
    if (node.modelPath) {
      setSelectedModelPath(node.modelPath);
      return;
    }
    if (isNodeInNonSelectableSection(node)) return;
    setSelectedStructureNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleHover = useCallback((node: ShipTreeNode | null) => {
    setHoveredStructureNode(node);
  }, []);

  const handleSelectByClick = useCallback((node: ShipTreeNode | null) => {
    setSelectedStructureNode(node);
  }, []);

  const setSectionVisible = useCallback(
    (node: ShipTreeNode, visible: boolean) => {
      const ids = collectNodeIds(node);
      setVisibleNodeIds((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = visible;
        return next;
      });
    },
    []
  );

  const hiddenNodeIds = useMemo(
    () =>
      new Set(
        Object.entries(visibleNodeIds)
          .filter(([, v]) => v === false)
          .map(([id]) => id)
      ),
    [visibleNodeIds]
  );

  const tree = modelTree ?? MOCK_SHIP_TREE;

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
      }
    },
    [tree, setMode]
  );

  const isOntologyMode = mode === "ontology";
  const isSystemsView = !isOntologyMode && liveView.view === "systems";
  // The callouts give way to a selected component's own details
  const isShowingCallouts =
    isSystemsView &&
    liveView.isShowingCallouts &&
    selectedStructureNode === null &&
    isModelReady;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CockpitTopBar
        mode={mode}
        onModeChange={(next) => void setMode(next)}
        onOpenAlarm={handleOpenAlarm}
      />
      <div className="relative flex min-h-0 w-full flex-1 gap-0">
        {/*
        Dims the scene while the overlay sidebar is open, and closes it on tap.
        `lg:hidden` because above the breakpoint the sidebar never covers
        anything and there is nothing to dismiss.
      */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden
          />
        )}

        <SidebarToggleButton
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
        />

        <div
          className={cn(
            // Below lg: an overlay that slides in from the left over the scene.
            "absolute inset-y-0 left-0 z-50 flex min-h-0 shrink-0 flex-col",
            "transition-transform duration-300 ease-out",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
            // At lg: back to a static docked column, always visible.
            "lg:relative lg:z-auto lg:translate-x-0 lg:transition-none",
            SIDEBAR_WIDTH_CLASS
          )}
        >
          <OntologyExplorer
            tree={tree}
            visibleNodeIds={visibleNodeIds}
            onToggleSectionVisible={setSectionVisible}
            onSelect={(node) => {
              handleSelectNode(node);
              setIsSidebarOpen(false);
            }}
            selectedNodeId={selectedStructureNode?.id ?? null}
            isLoading={modelTree === null}
            onClose={() => setIsSidebarOpen(false)}
            footer={
              isOntologyMode ? (
                <LiveWarningCard onOpen={handleOpenAlarm} />
              ) : (
                <AlarmsEventsList onOpen={handleOpenAlarm} />
              )
            }
            renderReading={isOntologyMode ? undefined : renderLiveReading}
          />
        </div>
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col",
            "transition-[padding] duration-300 ease-out",
            /*
            Below lg the sheet is an opaque panel across the bottom. Padding the
            scene by its height keeps the ship centred in the space that is
            left, instead of behind the sheet.

            The padding is short of the sheet's full height by SHEET_PEEK, so
            the scene runs a little way behind its top edge and shows through
            the rounded corners. Matching the height exactly left nothing behind
            them and the sheet read as square.
          */
            selectedStructureNode !== null &&
              (isDetailsExpanded
                ? "pb-[calc(80vh-20px)]"
                : "pb-[calc(45vh-20px)]"),
            "lg:pb-0"
          )}
        >
          <div className="relative min-h-0 w-full flex-1">
            <SceneErrorFallback
              fallback={
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas text-muted">
                  <p>Scene failed to load.</p>
                  <p className="text-sm">
                    Add a ship model at{" "}
                    <code className="rounded bg-card px-1">public/ship/</code>
                  </p>
                </div>
              }
            >
              <Scene isDetailsOpen={selectedStructureNode !== null}>
                <Ship
                  modelPath={renderedModelPath}
                  selectedStructureNode={selectedStructureNode}
                  hoveredStructureNode={hoveredStructureNode}
                  hiddenNodeIds={hiddenNodeIds}
                  onModelTreeLoaded={handleModelTreeLoaded}
                  tree={tree}
                  onHover={handleHover}
                  onSelectByClick={handleSelectByClick}
                  onAssemblyPointsSampled={setAssemblyTargets}
                  isInteractive={loading.isInteractive}
                />
                {isShowingCallouts && <CalloutAnchorProjector />}
                {loading.isRingVisible && (
                  <SceneErrorFallback fallback={null}>
                    <LoadingRing
                      phase={loading.phase}
                      assemblyTargets={assemblyTargets}
                    />
                  </SceneErrorFallback>
                )}
              </Scene>
            </SceneErrorFallback>
            {isShowingCallouts && (
              <SystemCallouts
                onOpenComponent={handleSelectConnectedComponent}
              />
            )}
            {!isOntologyMode && (
              <LiveViewControls
                view={liveView.view}
                onViewChange={(view) => void liveView.setView(view)}
                isShowingCallouts={liveView.isShowingCallouts}
                onShowCalloutsChange={(isShowing) =>
                  void liveView.setIsShowingCallouts(isShowing)
                }
              />
            )}
            <SelectionDetailsModal
              // A new card for each component: it opens scrolled to its top
              key={selectedStructureNode?.id}
              selectedNode={selectedStructureNode}
              isExpanded={isDetailsExpanded}
              onToggleExpanded={() => setIsDetailsExpanded((open) => !open)}
              onClose={() => {
                setSelectedStructureNode(null);
                setIsDetailsExpanded(false);
              }}
              onSelectConnectedComponent={handleSelectConnectedComponent}
              onShowLiveData={
                isOntologyMode ? () => void setMode("live") : undefined
              }
            />
          </div>
          {isOntologyMode && selectedStructureNode !== null && (
            <OntologyRelationsStrip
              selectedNode={selectedStructureNode}
              onSelectRelated={handleSelectConnectedComponent}
              onShowSensors={() => void setMode("live")}
            />
          )}
          {!isOntologyMode && <SystemCardsStrip />}
        </div>
      </div>
    </div>
  );
}
