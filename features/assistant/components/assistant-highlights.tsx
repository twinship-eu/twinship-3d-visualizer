"use client";

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { clearHighlights, useAssistantState } from "../lib/assistant-store";
import { highlightAnchors, subscribeToHighlightAnchors } from "../lib/highlight-anchors";

/**
 * Where a highlight's label sits from its component's dot, in CSS pixels:
 * alternately above and below, out to the side, so neighbours part.
 */
const LABEL_OFFSETS = [
  { x: 36, y: -86 },
  { x: -196, y: 64 },
  { x: 48, y: 72 },
  { x: -210, y: -92 },
  { x: 60, y: -150 },
] as const;

type Props = { onOpenComponent: (label: string) => void };

/**
 * Over the scene: what the assistant's last answer talks about, lit up on the
 * ship — a dot on each component and a label with why — and the way to clear
 * them. Moved every frame outside React, as the callouts are.
 */
export function AssistantHighlights({ onOpenComponent }: Props) {
  const { highlights } = useAssistantState();
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  useEffect(
    () =>
      subscribeToHighlightAnchors(() => {
        highlights.forEach((highlight, index) => {
          const anchor = highlightAnchors[highlight.component];
          const dot = dotRefs.current[index];
          const label = labelRefs.current[index];
          const line = lineRefs.current[index];
          if (!dot || !label || !line) return;
          const isShown = !!anchor?.isVisible;
          for (const element of [dot, label, line]) element.style.visibility = isShown ? "visible" : "hidden";
          if (!anchor || !isShown) return;
          const offset = LABEL_OFFSETS[index % LABEL_OFFSETS.length];
          const labelX = anchor.x + offset.x;
          const labelY = anchor.y + offset.y;
          dot.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -50%)`;
          label.style.transform = `translate(${labelX}px, ${labelY}px)`;
          line.setAttribute("x1", String(anchor.x));
          line.setAttribute("y1", String(anchor.y));
          line.setAttribute("x2", String(labelX + label.offsetWidth / 2));
          line.setAttribute("y2", String(labelY + (offset.y < 0 ? label.offsetHeight : 0)));
        });
      }),
    [highlights]
  );

  if (highlights.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
      <div className="pointer-events-auto absolute top-[68px] left-4 flex items-center gap-3 rounded-lg border border-accent-line bg-glass py-1.5 pr-1.5 pl-3.5 text-[13px] text-ink backdrop-blur">
        <MessageCircle className="size-4 text-accent-ink" aria-hidden />
        <span>
          <b className="font-semibold">
            {highlights.length} component{highlights.length === 1 ? "" : "s"}
          </b>{" "}
          highlighted by the assistant
        </span>
        <button type="button" onClick={clearHighlights} className="cursor-pointer rounded-md bg-btn px-2.5 py-1 font-semibold hover:brightness-110">
          Clear
        </button>
      </div>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {highlights.map((highlight, index) => (
          <line
            key={highlight.component}
            ref={(element) => {
              lineRefs.current[index] = element;
            }}
            className="stroke-leader"
            strokeWidth={1}
            style={{ visibility: "hidden" }}
          />
        ))}
      </svg>
      {highlights.map((highlight, index) => (
        <span
          key={`${highlight.component}-dot`}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
          className="absolute top-0 left-0 size-4 rounded-full border-2 border-white bg-warn shadow-[0_0_12px_var(--color-warn)]"
          style={{ visibility: "hidden" }}
          aria-hidden
        />
      ))}
      {highlights.map((highlight, index) => (
        <button
          key={highlight.component}
          ref={(element) => {
            labelRefs.current[index] = element;
          }}
          type="button"
          onClick={() => onOpenComponent(highlight.component)}
          style={{ visibility: "hidden" }}
          className="pointer-events-auto absolute top-0 left-0 flex max-w-[240px] cursor-pointer flex-col rounded-lg border border-glass-line bg-glass px-3.5 py-2 text-left backdrop-blur hover:border-accent-line"
        >
          <span className="text-[13px] font-semibold">{highlight.component}</span>
          {highlight.note && <span className="text-xs text-ink-2">{highlight.note}</span>}
        </button>
      ))}
    </div>
  );
}
