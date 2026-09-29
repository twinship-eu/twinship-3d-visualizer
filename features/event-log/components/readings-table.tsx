"use client";

import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import { READINGS_STEP_SECONDS } from "../event-log-config";
import type { ReadingColumn } from "../lib/reading-columns";

type Props = { history: LiveSnapshot[]; columns: ReadingColumn[] };

/**
 * The time series itself: the kept history's readings, newest first, a row
 * every READINGS_STEP_SECONDS — the export has every second.
 */
export function ReadingsTable({ history, columns }: Props) {
  const rows = history.filter((_, index) => (history.length - 1 - index) % READINGS_STEP_SECONDS === 0).reverse();

  return (
    <div className="min-h-0 overflow-auto text-[13px]">
      <table className="w-full border-separate border-spacing-0">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-muted">
            <th className="border-b border-line px-5 py-3 font-semibold">TIME UTC</th>
            {columns.map((column) => (
              <th key={column.id} className="border-b border-line px-3 py-3 text-right font-semibold whitespace-nowrap">
                {column.label.toUpperCase()} <span className="font-normal normal-case">{column.unit}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((snapshot) => (
            <tr key={snapshot.timestamp} className="hover:bg-card">
              <td className="border-b border-line px-5 py-2 font-mono">{formatUtcTime(snapshot.timestamp)}</td>
              {columns.map((column) => {
                const value = column.value(snapshot);
                return (
                  <td key={column.id} className="border-b border-line px-3 py-2 text-right font-mono tabular-nums">
                    {value === undefined ? "—" : value.toFixed(column.digits)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-5 py-6 text-muted">No readings yet.</p>}
    </div>
  );
}
