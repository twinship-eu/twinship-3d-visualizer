"use client";

import { Activity, ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShipTreeNode } from "../ship-visualizer-types";
import { getObjectDetailsForNode } from "../selection-details";
import { getSectionDotClass, getSectionIdOf } from "../lib/section-colors";
import type { ConnectedComponent } from "./selection-details-modal-types";

const SECTION_HEADER_CLASS = "text-[11px] font-semibold tracking-[0.12em] text-accent-ink";

type Props = {
  selectedNode: ShipTreeNode | null;
  /** Whether the sheet is at its tall height. Below lg only. */
  isExpanded?: boolean;
  /** Toggles that height. Omit to hide the control. */
  onToggleExpanded?: () => void;
  onClose: () => void;
  onSelectConnectedComponent?: (targetLabel: string) => void;
  /** Opens the component in Live data; omitted there. */
  onShowLiveData?: () => void;
};

/**
 * Room kept under the card at lg, so the zoom controls in the scene's bottom
 * right stay in view: their height and a gap.
 */
const ZOOM_CONTROLS_CLEARANCE = "220px";

/**
 * The selected component's card: what it is, its parameters from the
 * ontology, and the way to its live data. At lg a card over the scene's top
 * right, its relations in the strip under the scene (`OntologyRelationsStrip`);
 * below lg a bottom sheet holding them too.
 */
export function SelectionDetailsModal({
  selectedNode,
  isExpanded = false,
  onToggleExpanded,
  onClose,
  onSelectConnectedComponent,
  onShowLiveData,
}: Props) {
  if (selectedNode === null) return null;

  const details = getObjectDetailsForNode(selectedNode);
  const { title, titleHref, tags, description, parameters, connectedComponents } = details;
  const displayTitle = title ?? selectedNode.label;
  const dotClass = getSectionDotClass(getSectionIdOf(selectedNode));

  return (
    <div
      className={cn(
        "z-30 flex flex-col overflow-hidden border-line bg-surface text-ink shadow-[0_12px_32px_rgba(2,8,23,0.25)]",
        // Below lg: a bottom sheet spanning the full width. Its height is
        // fixed rather than capped, because the scene pads itself by exactly
        // this much to keep the ship centred -- a height that varied with
        // content would not line up.
        "fixed inset-x-0 bottom-0 rounded-t-2xl border-t transition-[height] duration-300 ease-out",
        isExpanded ? "h-[80vh]" : "h-[45vh]",
        // At lg: the design's card over the scene's top right
        "lg:absolute lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-auto lg:h-auto lg:max-h-[calc(100%-2rem-var(--zoom-controls-clearance))] lg:w-[360px] lg:rounded-xl lg:border"
      )}
      style={{ "--zoom-controls-clearance": ZOOM_CONTROLS_CLEARANCE } as React.CSSProperties}
      role="dialog"
      aria-labelledby="selection-details-title"
    >
      {/* Grab-handle affordance, so the sheet reads as a sheet. Visual only. */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
      <header className="flex shrink-0 flex-col gap-2 border-b border-line px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", dotClass)} aria-hidden />
          <h2 id="selection-details-title" className="min-w-0 grow truncate text-lg font-bold">
            {titleHref ? (
              <a
                href={titleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 text-ink hover:text-accent-ink"
                aria-label={`${displayTitle} (opens in new tab)`}
              >
                <span className="min-w-0 truncate">{displayTitle}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
              </a>
            ) : (
              displayTitle
            )}
          </h2>
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              aria-expanded={isExpanded}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
            >
              {isExpanded ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and deselect"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-btn hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-[10px] bg-accent-soft px-2.5 py-0.5 text-xs text-accent-ink">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 py-3.5 text-[13px]">
        <section className="flex flex-col gap-1.5">
          <h3 className={SECTION_HEADER_CLASS}>DESCRIPTION</h3>
          <p className="leading-[1.45] text-ink-2">{description}</p>
        </section>

        {parameters.length > 0 && (
          <section className="flex flex-col">
            <h3 className={cn(SECTION_HEADER_CLASS, "mb-1")}>PARAMETERS</h3>
            <dl>
              {parameters.map((parameter) => (
                <div
                  key={parameter.name + (parameter.href ?? "")}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0"
                >
                  <dt className="min-w-0 text-ink-2">
                    {parameter.href ? (
                      <a
                        href={parameter.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent-ink hover:text-accent"
                        aria-label={`${parameter.name} (opens in new tab)`}
                      >
                        {parameter.name}
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>
                    ) : (
                      parameter.name
                    )}
                  </dt>
                  <dd className="min-w-0 shrink text-right font-semibold">{parameter.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {onShowLiveData && (
          <button
            type="button"
            onClick={onShowLiveData}
            className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Activity className="size-4" aria-hidden />
            Show live data for {displayTitle}
          </button>
        )}

        {/* At lg the relations are in the strip under the scene */}
        {connectedComponents.length > 0 && (
          <section className="lg:hidden">
            <h3 className={cn(SECTION_HEADER_CLASS, "mb-2")}>
              CONNECTED COMPONENTS ({connectedComponents.length})
            </h3>
            <ul className="space-y-2">
              {connectedComponents.map((component) => (
                <ConnectedComponentRow
                  key={component.id}
                  component={component}
                  onSelect={onSelectConnectedComponent}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

type ConnectedComponentRowProps = {
  component: ConnectedComponent;
  onSelect?: (targetLabel: string) => void;
};

function ConnectedComponentRow({ component, onSelect }: ConnectedComponentRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(component.id)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-left transition-colors hover:border-accent-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", getSectionDotClass(getSectionIdOf({ id: component.id, label: component.label })))}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">
            {component.label}
          </span>
          {component.category && (
            <span className="block truncate text-xs text-muted">
              {component.category}
            </span>
          )}
        </span>
        <span className="shrink-0 text-muted" aria-hidden>
          →
        </span>
      </button>
    </li>
  );
}
