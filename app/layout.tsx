import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinShip 3D Viewer",
  description: "Ontology based 3D viewer for TwinShip futuristic Vessel",
};

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
    <html lang="en" className="w-full h-full">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased w-full h-full min-h-0 overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
