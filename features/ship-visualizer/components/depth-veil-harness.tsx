"use client";

type Props = {
  depth: number;
  onDepthChange: (depth: number) => void;
  onReplay: () => void;
};

/**
 * Development-only control for tuning the loading veil. A shader whose whole
 * appearance is a function of depth cannot be judged during a real load, which
 * shows each depth for a fraction of a second.
 */
export function DepthVeilHarness({ depth, onDepthChange, onReplay }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-md bg-white/95 p-2 shadow-md">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
        depth
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={depth}
          onChange={(event) => onDepthChange(Number(event.target.value))}
          className="w-32"
        />
        <span className="w-8 font-mono text-[10px] text-gray-500">
          {depth.toFixed(2)}
        </span>
      </label>
      <button
        type="button"
        onClick={onReplay}
        className="cursor-pointer rounded bg-primary px-2 py-1 text-xs font-medium text-white"
      >
        Replay
      </button>
    </div>
  );
}
