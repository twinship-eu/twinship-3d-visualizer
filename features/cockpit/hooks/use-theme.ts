"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "../cockpit-config";

const listeners = new Set<() => void>();

/** The theme on <html>: set before the first paint by THEME_BOOT_SCRIPT. */
function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies, for this visit
  }
  listeners.forEach((listener) => listener());
}

/**
 * The cockpit's theme, and a toggle. The theme lives on <html> as
 * `data-theme`, which the design tokens in globals.css follow, and is
 * remembered per browser.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const toggleTheme = useCallback(() => applyTheme(theme === "dark" ? "light" : "dark"), [theme]);

  return { theme, toggleTheme };
}
