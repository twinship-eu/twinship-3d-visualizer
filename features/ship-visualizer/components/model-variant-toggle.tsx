"use client";

import { cn } from "@/lib/utils";

export type ModelVariant = "previous" | "optimized" | "raw";

const OPTIONS: { id: ModelVariant; label: string; hint: string }[] = [
  { id: "previous", label: "V1", hint: "V1, the model V2 replaced, ~12 MB" },
  { id: "optimized", label: "Optimized", hint: "V2, 2K WebP, ~24 MB" },
  { id: "raw", label: "Raw", hint: "V2, 4K PNG, ~176 MB" },
];

type Props = {
  value: ModelVariant;
  onChange: (value: ModelVariant) => void;
  isLoading: boolean;
};

/**
 * Development-only switch between the shipped V2 model, its raw Blender export
 * and the V1 model V2 replaced, for judging texture compression and the new
 * export side by side. The camera is deliberately left alone when switching so
 * every variant can be compared from the same angle.
 */
export function ModelVariantToggle({ value, onChange, isLoading }: Props) {
  return (
    <div
      className="absolute right-4 top-4 z-20 flex flex-col items-end gap-1"
      aria-label="Ship model variant (development only)"
    >
      <div className="flex items-center gap-0.5 rounded-md bg-white/95 p-1 shadow-md">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            title={option.hint}
            className={cn(
              "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              value === option.id
                ? "bg-primary text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] text-gray-500 shadow-sm">
        {isLoading
          ? "Loading textures…"
          : OPTIONS.find((o) => o.id === value)?.hint}
      </span>
    </div>
  );
}
