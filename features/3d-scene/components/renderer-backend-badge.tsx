"use client";

type Props = {
  isWebGPU: boolean | null;
};

/**
 * Development-only readout of the resolved graphics backend, so it is visible at
 * a glance which path a device took.
 */
export function RendererBackendBadge({ isWebGPU }: Props) {
  if (isWebGPU === null) return null;

  return (
    <span className="pointer-events-none absolute bottom-4 left-4 z-20 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
      {isWebGPU ? "WebGPU" : "WebGL2"}
    </span>
  );
}
