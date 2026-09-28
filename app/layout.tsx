import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { THEME_BOOT_SCRIPT } from "@/features/cockpit/cockpit-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinShip 3D Viewer",
  description: "Ontology based 3D viewer for TwinShip futuristic Vessel",
};

/**
 * The cockpit design's typefaces, served from the app itself: Barlow for text,
 * JetBrains Mono for readings. Both SIL Open Font License, Latin subset.
 */
const barlow = localFont({
  src: [
    { path: "./fonts/barlow-400.woff2", weight: "400" },
    { path: "./fonts/barlow-500.woff2", weight: "500" },
    { path: "./fonts/barlow-600.woff2", weight: "600" },
    { path: "./fonts/barlow-700.woff2", weight: "700" },
  ],
  variable: "--font-barlow",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-400.woff2", weight: "400" },
    { path: "./fonts/jetbrains-mono-500.woff2", weight: "500" },
    { path: "./fonts/jetbrains-mono-600.woff2", weight: "600" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Without this the browser assumes a ~980px desktop viewport on a phone and
 * scales the whole page down, so no breakpoint ever fires and the mobile layout
 * is never seen.
 *
 * Pinch-zoom is disabled deliberately: the scene is an orbit camera driven by
 * the same pinch gesture, and browser zoom fighting it makes both unusable.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme is set on <html> before hydration (THEME_BOOT_SCRIPT), so its
    // attribute differs from the server's by design
    <html lang="en" className="w-full h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${barlow.variable} ${jetbrainsMono.variable} antialiased w-full h-full min-h-0 overflow-hidden`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
