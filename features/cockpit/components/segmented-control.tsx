"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Shown but not choosable yet, with why in its title. */
  disabledReason?: string;
};

type Props<T extends string> = {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A row of mutually exclusive buttons in the design's glass style, over the scene. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="pointer-events-auto flex gap-0.5 rounded-[9px] border border-glass-line bg-glass p-[3px] backdrop-blur"
    >
      {options.map(({ value: option, label: optionLabel, icon: Icon, disabledReason }) => {
        const isActive = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            disabled={!!disabledReason}
            title={disabledReason}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[13px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              isActive ? "bg-seg-on font-semibold text-seg-on-ink" : "font-medium text-seg-off",
              disabledReason ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-ink"
            )}
          >
            {Icon && <Icon className="size-4" />}
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
