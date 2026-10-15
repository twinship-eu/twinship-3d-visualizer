"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";

/** Switches the cockpit between its dark and light themes. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      className="flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-ink hover:bg-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isDark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
