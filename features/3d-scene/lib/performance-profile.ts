/**
 * How much the scene draws, by device: phones get a lighter profile.
 *
 * The cost on a phone is mostly pixels — its screen at a device pixel ratio of
 * 3, each pixel through the sea's shader, the bloom and FXAA — and the passes
 * that redraw the ship off screen (its shadow, the hull foam's footprint). The
 * profile trades a little sharpness and detail for frame rate there.
 */
import { isAndroidUserAgent, isIOSUserAgent } from "./webgpu-renderer";

export type PerformanceProfile = {
  /** Most device pixels drawn per CSS pixel. */
  maxPixelRatio: number;
  /**
   * Fewest: how far the resolution may drop while the frame rate cannot keep
   * up (see `SceneAdaptiveResolution`).
   */
  minPixelRatio: number;
  /** Bloom's passes: several blurs at falling resolutions, over the whole screen. */
  isBloomEnabled: boolean;
  /** Sea grid segments per side. */
  gridSegments: number;
  /** The FFT ocean is brought up to date every this many frames. */
  oceanUpdateFrames: number;
  /** Texels along each side of the hull foam's footprint. */
  contactFoamResolution: number;
  /** The footprint is redrawn every this many frames. */
  contactFoamRedrawFrames: number;
  /** Texels along each side of the sun's shadow map. */
  shadowMapSize: number;
  /**
   * The shadow map is redrawn every this many frames: it draws the whole ship
   * again, and the sun stands still while the ship only sways slowly.
   */
  shadowRedrawFrames: number;
};

const DESKTOP: PerformanceProfile = {
  maxPixelRatio: 2,
  minPixelRatio: 1,
  isBloomEnabled: true,
  gridSegments: 320,
  oceanUpdateFrames: 1,
  contactFoamResolution: 1024,
  contactFoamRedrawFrames: 2,
  shadowMapSize: 2048,
  shadowRedrawFrames: 2,
};

const MOBILE: PerformanceProfile = {
  // 1.25 of a phone's 3: sharp enough at arm's length, under a fifth of the pixels
  maxPixelRatio: 1.25,
  // Softer, but still readable on a small screen: better than a stutter
  minPixelRatio: 0.8,
  isBloomEnabled: false,
  gridSegments: 160,
  // The waves at 30 Hz: slow enough changes that a skipped frame never shows
  oceanUpdateFrames: 2,
  contactFoamResolution: 512,
  contactFoamRedrawFrames: 4,
  shadowMapSize: 1024,
  shadowRedrawFrames: 3,
};

/** Whether this is a phone or tablet: Android, or iOS and iPadOS. */
export function isMobileDevice(): boolean {
  return isAndroidUserAgent() || isIOSUserAgent();
}

/** The profile for this device. On the server, desktop's (nothing is drawn there). */
export function getPerformanceProfile(): PerformanceProfile {
  return isMobileDevice() ? MOBILE : DESKTOP;
}
