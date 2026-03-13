"use client";

import { Ship } from "lucide-react";
import { SHIP_VISUALIZER_LAYOUT } from "@/features/ship-visualizer/ship-visualizer-config";

const LOADER_PANEL_WIDTH_PX = SHIP_VISUALIZER_LAYOUT.MAX_LEFT_PANEL_WIDTH_PX;

/** Skeleton layout matching Ontology Explorer: Ship model + section groups with children. */
const SKELETON_SECTIONS = [
  { label: "Ship model", childCount: 1 },
  { label: "Hull", childCount: 4 },
  { label: "Superstructure", childCount: 3 },
  { label: "Deck equipment", childCount: 3 },
  { label: "Propulsion", childCount: 3 },
] as const;

export function OntologyExplorerSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-white dark:bg-sidebar"
      style={{ width: LOADER_PANEL_WIDTH_PX }}
    >
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Ship
            className="size-5 shrink-0 text-primary opacity-70"
            aria-hidden
          />
          <div
            className="h-4 w-32 rounded bg-sidebar-accent animate-pulse"
            aria-hidden
          />
        </div>
        <div
          className="h-9 w-full rounded-md border border-border bg-sidebar-accent/50 animate-pulse"
          aria-hidden
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          {SKELETON_SECTIONS.map((section, sectionIndex) => (
            <div key={sectionIndex} className="flex flex-col gap-1">
              <div
                className="flex items-center gap-2 rounded px-2 py-1.5"
                style={{ paddingLeft: 8 }}
              >
                <div className="size-4 shrink-0 rounded bg-sidebar-accent animate-pulse" />
                <div
                  className="h-4 flex-1 max-w-[70%] rounded bg-sidebar-accent animate-pulse"
                  style={{ animationDelay: `${sectionIndex * 50}ms` }}
                />
              </div>
              {Array.from({ length: section.childCount }).map((_, childIndex) => (
                <div
                  key={childIndex}
                  className="flex items-center gap-2 rounded px-2 py-1.5"
                  style={{ paddingLeft: 8 + 14 }}
                >
                  <div className="size-4 shrink-0 rounded bg-sidebar-accent/70 animate-pulse" />
                  <div
                    className="h-3.5 w-24 rounded bg-sidebar-accent/70 animate-pulse"
                    style={{
                      animationDelay: `${(sectionIndex * 50 + childIndex * 30) % 500}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
