import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinShip 3D Viewer",
  description: "Ontology based 3D viewer for TwinShip futuristic Vessel",
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
