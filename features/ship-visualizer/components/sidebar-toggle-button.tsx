"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onOpen: () => void;
};

/**
 * Opens the ontology sidebar below the desktop breakpoint.
 *
 * Only opens. Closing is done by the panel's own header button, which sits
 * beside the title -- a floating control that stayed put would overlap the
 * header it had just revealed.
 *
 * Hidden at `lg` and above, where the sidebar is a permanently docked column
 * and there is nothing to toggle.
 */
export function SidebarToggleButton({ isOpen, onOpen }: Props) {
  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open components panel"
      aria-expanded={false}
      className={cn(
        "absolute left-3 top-3 z-50 flex h-11 w-11 items-center justify-center",
        "rounded-full bg-white/95 text-gray-700 shadow-md backdrop-blur",
        "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "lg:hidden"
      )}
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}
