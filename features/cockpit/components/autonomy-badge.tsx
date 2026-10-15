"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AUTONOMY_LEVELS } from "../cockpit-config";

/** The levels as the cockpit defines them: "Conditional autonomy: the ship sails itself…" split at the colon. */
const LEVELS = Object.entries(AUTONOMY_LEVELS).map(([level, description]) => {
  const [title, ...rest] = description.split(": ");
  return { level, title, text: rest.join(": ") };
});

/**
 * The top bar's autonomy badge: AUTO · L3. Clicked, it explains the level the
 * ship sails at, among all the levels.
 */
export function AutonomyBadge({ level }: { level: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LEVELS.find((candidate) => candidate.level === level);

  // Closed by a click anywhere else, or Esc
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className="relative hidden shrink-0 lg:block">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={`Autonomy level ${level}${current ? `: ${current.title}` : ""}`}
        className="flex h-[30px] cursor-pointer items-center rounded-md border border-accent-line px-2.5 text-xs font-semibold tracking-[0.08em] text-accent-ink hover:bg-accent-soft"
      >
        AUTO · {level}
      </button>
      {isOpen && (
        <div role="dialog" aria-label="Autonomy level" className="absolute top-[38px] right-0 z-50 flex w-80 flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 text-[13px] whitespace-normal text-ink shadow-lg">
          <p>
            <strong>Autonomy level {level}</strong>
            {current && <span className="text-ink-2"> · {current.title}</span>}
          </p>
          <p className="text-ink-2">How far the ship sails itself, and who is in charge:</p>
          <ol className="flex flex-col gap-1.5">
            {LEVELS.map((candidate) => (
              <li
                key={candidate.level}
                className={cn("rounded-lg border px-3 py-2", candidate.level === level ? "border-accent-line bg-accent-soft" : "border-line")}
              >
                <span className="font-semibold">
                  {candidate.level} · {candidate.title}
                </span>
                <span className="block text-xs text-ink-2">{candidate.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
