"use client";

import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
};

/**
 * Opens the ontology sidebar below the desktop breakpoint.
 *
 * Hidden at `lg` and above, where the sidebar is a permanently docked column
 * and there is nothing to toggle.
 */
export function SidebarToggleButton({ isOpen, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isOpen ? "Close components panel" : "Open components panel"}
      aria-expanded={isOpen}
      className={cn(
        "absolute left-3 top-3 z-50 flex h-11 w-11 items-center justify-center",
        "rounded-full bg-white/95 text-gray-700 shadow-md backdrop-blur",
        "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "lg:hidden"
      )}
    >
      {isOpen ? (
        <X className="h-5 w-5" aria-hidden />
      ) : (
        <Menu className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
