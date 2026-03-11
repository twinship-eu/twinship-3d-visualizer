"use client";

import { Info, Link2, Maximize2, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { getObjectDetails } from "../selection-details-mock";
import type { ConnectedComponent } from "./selection-details-modal-types";

const MODAL_WIDTH_PX = 380;
const SECTION_HEADER_CLASS =
  "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600";
const CONNECTED_HEADER_CLASS =
  "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-600";

type Props = {
  selectedNode: ShipTreeNode | null;
  onClose: () => void;
};

export function SelectionDetailsModal({ selectedNode, onClose }: Props) {
  if (selectedNode === null) return null;

  const details = getObjectDetails(selectedNode.id);
  const {
    title,
    tags,
    description,
    parameters,
    connectedComponents,
  } = details;
  const displayTitle = title ?? selectedNode.label;

  return (
    <div
      className="absolute bottom-4 right-4 z-20 flex flex-col rounded-lg bg-white shadow-lg"
      style={{ width: MODAL_WIDTH_PX, maxWidth: "calc(100vw - 2rem)" }}
      role="dialog"
      aria-labelledby="selection-details-title"
    >
      <header className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-red-500"
              aria-hidden
            />
            <h2
              id="selection-details-title"
              className="truncate text-lg font-semibold text-gray-900"
            >
              {displayTitle}
            </h2>
          </div>
          {tags && tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Expand"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Maximize2 className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and deselect"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex max-h-[60vh] flex-col overflow-y-auto px-4 py-3">
        <section className="mb-4">
          <h3 className={cn(SECTION_HEADER_CLASS, "mb-1")}>
            <Info className="h-3.5 w-3.5" aria-hidden />
            Description
          </h3>
          <p className="text-sm text-gray-700">{description}</p>
        </section>

        {parameters.length > 0 && (
          <section className="mb-4">
            <h3 className={cn(SECTION_HEADER_CLASS, "mb-2")}>
              <Settings className="h-3.5 w-3.5" aria-hidden />
              Parameters
            </h3>
            <dl className="space-y-1.5 text-sm">
              {parameters.map((p) => (
                <div
                  key={p.name}
                  className="flex justify-between gap-4 border-b border-gray-100 pb-1 last:border-0"
                >
                  <dt className="text-gray-600">{p.name}</dt>
                  <dd className="font-medium text-gray-900">{p.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section>
          <h3 className={cn(CONNECTED_HEADER_CLASS, "mb-2")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Connected components ({connectedComponents.length})
          </h3>
          <ul className="space-y-2">
            {connectedComponents.map((comp) => (
              <ConnectedComponentRow key={comp.id} component={comp} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ConnectedComponentRow({ component }: { component: ConnectedComponent }) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">
            {component.label}
          </span>
          {component.category && (
            <span className="block truncate text-xs text-gray-500">
              {component.category}
            </span>
          )}
        </span>
        <span className="shrink-0 text-gray-400" aria-hidden>
          →
        </span>
      </button>
    </li>
  );
}
