"use client";

/**
 * Charts for the Stats page, drawn with plain HTML (no chart library).
 *
 * BarChart: one bar per week/day, stacked when there are several series.
 * Tap (or hover) a bar to see its numbers in the readout above the chart;
 * the newest bar is picked to start. Thin bars, 2px gaps between stacked
 * pieces, rounded tops, quiet axes, a legend whenever there's more than one
 * series, and an optional dashed goal line.
 */
import { useState } from "react";
import { cx } from "@/components/ui";
import { compact } from "@/lib/stats";

/**
 * How numbers are written. A name, not a function: the Stats page is a server
 * component, and functions can't be sent from the server to the browser.
 */
export type NumberStyle = "plain" | "compact" | "money";
const FORMATS: Record<NumberStyle, (n: number) => string> = {
  plain: (n) => n.toLocaleString(),
  compact,
  money: (n) => `$${compact(n)}`,
};

export type Series = { name: string; color: string; values: number[] };

export function BarChart({
  labels,
  series,
  unit = "",
  format: style = "plain",
  goal,
  goalLabel,
  height = 140,
  emptyText = "Nothing yet",
}: {
  labels: string[];
  series: Series[];
  unit?: string;
  format?: NumberStyle;
  goal?: number | null;
  goalLabel?: string;
  height?: number;
  emptyText?: string;
}) {
  const format = FORMATS[style];
  const totals = labels.map((_, i) => series.reduce((n, s) => n + (s.values[i] ?? 0), 0));
  const top = Math.max(goal ?? 0, ...totals, 1);
  const [picked, setPicked] = useState(labels.length - 1);
  const empty = totals.every((t) => t === 0);
  const sel = Math.min(picked, labels.length - 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Readout: what the picked bar says */}
      <div className="flex min-h-[2.75rem] flex-wrap items-end justify-between gap-x-4 gap-y-1" aria-live="polite">
        <div>
          <p className="text-xs text-faint">{labels[sel]}</p>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums text-ink">
            {format(totals[sel])}
            {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
          </p>
        </div>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.name} <span className="text-ink tabular-nums">{format(s.values[sel] ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative" style={{ height }}>
        {/* Top value and baseline: quiet guides */}
        <span className="absolute top-0 left-0 text-[10px] text-faint tabular-nums">{format(top)}</span>
        <div className="absolute inset-x-0 top-2 border-t border-dashed border-line/60" />
        <div className="absolute inset-x-0 bottom-0 border-t border-line" />
        {goal ? (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink/40" style={{ bottom: `${(goal / top) * 100}%` }}>
            {goalLabel && <span className="absolute -top-4 right-0 text-[10px] text-muted">{goalLabel}</span>}
          </div>
        ) : null}
        {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-faint">{emptyText}</p>}

        <div className="absolute inset-x-0 top-2 bottom-0 flex items-end gap-1.5">
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              data-silent
              onPointerEnter={(e) => e.pointerType === "mouse" && setPicked(i)}
              onClick={() => setPicked(i)}
              aria-label={`${label}: ${format(totals[i])}${unit ? ` ${unit}` : ""}`}
              aria-pressed={i === sel}
              // The whole column is the target, not just the (maybe tiny) bar.
              className="group flex h-full min-w-0 flex-1 flex-col-reverse items-stretch gap-[2px] rounded-md px-[3px] sm:px-2 outline-none focus-visible:bg-raised"
            >
              {series.map((s, k) => {
                const v = s.values[i] ?? 0;
                if (!v) return null;
                const isTop = series.slice(k + 1).every((later) => !(later.values[i] ?? 0));
                return (
                  <span
                    key={s.name}
                    className={cx("block w-full transition-opacity", isTop && "rounded-t", i !== sel && "opacity-55 group-hover:opacity-80")}
                    style={{ height: `${(v / top) * 100}%`, minHeight: 3, backgroundColor: s.color }}
                  />
                );
              })}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        {labels.map((label, i) => (
          <span key={label} className={cx("min-w-0 flex-1 truncate text-center text-[10px] tabular-nums", i === sel ? "text-ink" : "text-faint")}>
            {/* Every other label when there are many, so they never collide. */}
            {labels.length > 8 && i % 2 !== (labels.length - 1) % 2 ? "" : label.replace(/^Week of /, "")}
          </span>
        ))}
      </div>
    </div>
  );
}
