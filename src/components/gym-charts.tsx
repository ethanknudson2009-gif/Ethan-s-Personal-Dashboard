"use client";

/**
 * Gym progress charts: strength over time for one lift, pounds moved per
 * week, and split balance. Drawn by hand in SVG (no chart library). Touch or
 * hover a point/bar for its numbers; "Show numbers" opens the same data as a
 * table.
 */
import { useState } from "react";
import type { StrengthPoint, WeekPoint } from "@/lib/gym-progress";
import { formatLocalDate } from "@/lib/format";
import { cx } from "@/components/ui";

const W = 320;
const H = 150;
const PAD = { top: 16, right: 14, bottom: 22, left: 34 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

/** Round "nice" axis steps: 5, 10, 25, 50, 100… */
function niceStep(range: number, ticks = 3): number {
  const raw = Math.max(range / ticks, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}
const short = (d: string) => formatLocalDate(d).replace(/^\w+, /, ""); // "Nov 18"
const lbs = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  // Positioned in % of the chart so it scales with the SVG.
  const left = (x / W) * 100;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-card"
      style={{ left: `${Math.min(84, Math.max(16, left))}%`, top: `${(y / H) * 100}%`, marginTop: -8 }}
    >
      {children}
    </div>
  );
}

function StrengthChart({ points, name }: { points: StrengthPoint[]; name: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.e1rm);
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const step = niceStep(Math.max(hi0 - lo0, 10));
  const lo = Math.floor((lo0 - step / 2) / step) * step;
  const hi = Math.ceil((hi0 + step / 2) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 0.001; v += step) ticks.push(v);
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`${name}: estimated 1-rep max over ${points.length} workouts, from ${values[0]} to ${values[last]} pounds`}>
        {/* Recessive grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-faint)">
              {t}
            </text>
          </g>
        ))}
        {/* First and last dates */}
        <text x={x(0)} y={H - 6} textAnchor={points.length === 1 ? "middle" : "start"} fontSize={10} fill="var(--color-faint)">
          {short(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={x(last)} y={H - 6} textAnchor="end" fontSize={10} fill="var(--color-faint)">
            {short(points[last].date)}
          </text>
        )}
        {/* Crosshair */}
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />}
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.e1rm)}
            r={hover === i ? 5.5 : 4}
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        ))}
        {/* Direct label on the latest point */}
        <text x={x(last)} y={y(values[last]) - 10} textAnchor={points.length === 1 ? "middle" : "end"} fontSize={11} fontWeight={600} fill="var(--color-ink)">
          {values[last]} lb
        </text>
        {/* Hit targets: wide invisible columns, easy to touch */}
        {points.map((_, i) => {
          const left = i === 0 ? PAD.left - 10 : (x(i - 1) + x(i)) / 2;
          const right = i === last ? W - PAD.right + 10 : (x(i) + x(i + 1)) / 2;
          return (
            <rect
              key={`hit-${i}`}
              x={left}
              y={0}
              width={Math.max(right - left, 1)}
              height={H}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            />
          );
        })}
      </svg>
      {h && hover !== null && (
        <Tooltip x={x(hover)} y={y(h.e1rm)}>
          <span className="block font-semibold">{formatLocalDate(h.date)}</span>
          <span className="text-muted">
            Best set {h.weightLb} × {h.reps} → <span className="font-semibold text-ink">{h.e1rm} lb</span>
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function VolumeBars({ weeks }: { weeks: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.volume), 1);
  const step = niceStep(max, 2);
  const top = Math.ceil(max / step) * step;
  const slot = plotW / weeks.length;
  const barW = Math.min(26, slot - 2); // 2px gap between bars
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const h = hover !== null ? weeks[hover] : null;

  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`Pounds moved per week, last ${weeks.length} weeks`}>
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-faint)">
              {lbs(t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx0 = PAD.left + slot * i + slot / 2;
          const x0 = cx0 - barW / 2;
          const yTop = y(w.volume);
          const bh = PAD.top + plotH - yTop;
          const r = Math.min(4, bh / 2, barW / 2);
          const isThisWeek = i === weeks.length - 1;
          return (
            <g key={w.weekStart}>
              {w.volume > 0 && (
                // Rounded top, square bottom anchored on the baseline.
                <path
                  d={`M${x0},${PAD.top + plotH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${PAD.top + plotH} Z`}
                  fill="var(--color-accent)"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i % 2 === weeks.length % 2 || isThisWeek) && (
                <text x={cx0} y={H - 6} textAnchor="middle" fontSize={10} fill={isThisWeek ? "var(--color-ink)" : "var(--color-faint)"}>
                  {isThisWeek ? "This wk" : short(w.weekStart)}
                </text>
              )}
              <rect x={PAD.left + slot * i} y={0} width={slot} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <Tooltip x={PAD.left + slot * hover + slot / 2} y={y(h.volume)}>
          <span className="block font-semibold">Week of {short(h.weekStart)}</span>
          <span className="text-muted">
            <span className="font-semibold text-ink">{h.volume.toLocaleString()} lb</span> · {h.workouts} workout{h.workouts === 1 ? "" : "s"}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

export function GymCharts({
  lifts,
  series,
  weeks,
  split,
}: {
  /** Exercises with data, most trained first. */
  lifts: { id: string; name: string; sessions: number }[];
  series: Record<string, StrengthPoint[]>;
  weeks: WeekPoint[];
  split: { day: string; count: number; skipped: number }[];
}) {
  const [pick, setPick] = useState(lifts[0]?.id ?? null);
  const [table, setTable] = useState(false);
  const points = pick ? (series[pick] ?? []) : [];
  const name = lifts.find((l) => l.id === pick)?.name ?? "";
  const change = points.length > 1 ? points[points.length - 1].e1rm - points[0].e1rm : 0;
  const maxSplit = Math.max(...split.map((s) => s.count + s.skipped), 1);
  const anyWeek = weeks.some((w) => w.workouts > 0);

  if (!lifts.length && !anyWeek) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">📈 Progress</h2>
        <button type="button" onClick={() => setTable((v) => !v)} className="text-xs text-faint hover:text-ink">
          {table ? "Show charts" : "Show numbers"}
        </button>
      </div>

      {lifts.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/80 p-3">
          {/* Lift picker: one row of chips above the chart */}
          <div data-own-swipe className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {lifts.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setPick(l.id)}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-1 text-xs transition",
                  pick === l.id ? "border-accent bg-accent/15 font-semibold text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{name} · est. 1-rep max</p>
            {points.length > 1 && (
              <p className={cx("text-xs font-semibold tabular-nums", change > 0 ? "text-ok" : change < 0 ? "text-warn" : "text-muted")}>
                {change > 0 ? "▲ +" : change < 0 ? "▼ " : ""}
                {change} lb since {short(points[0].date)}
              </p>
            )}
          </div>
          {table ? (
            <table className="w-full text-xs">
              <thead className="text-faint">
                <tr>
                  <th className="py-1 text-left font-normal">Date</th>
                  <th className="text-right font-normal">Best set</th>
                  <th className="text-right font-normal">Est. 1RM</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...points].reverse().map((p) => (
                  <tr key={p.date} className="border-t border-line/60">
                    <td className="py-1">{formatLocalDate(p.date)}</td>
                    <td className="text-right">
                      {p.weightLb} × {p.reps}
                    </td>
                    <td className="text-right font-semibold">{p.e1rm} lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : points.length ? (
            <>
              <StrengthChart key={pick} points={points} name={name} />
              {points.length === 1 && <p className="text-center text-xs text-muted">Log {name.toLowerCase()} again to see your line.</p>}
            </>
          ) : null}
        </div>
      )}

      {anyWeek && (
        <div className="rounded-2xl border border-line bg-surface/80 p-3">
          <p className="mb-1 text-sm font-semibold">Pounds moved per week</p>
          {table ? (
            <table className="w-full text-xs tabular-nums">
              <tbody>
                {[...weeks].reverse().map((w) => (
                  <tr key={w.weekStart} className="border-t border-line/60 first:border-0">
                    <td className="py-1">Week of {short(w.weekStart)}</td>
                    <td className="text-right">{w.workouts} workouts</td>
                    <td className="text-right font-semibold">{w.volume.toLocaleString()} lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <VolumeBars weeks={weeks} />
          )}
        </div>
      )}

      {split.some((s) => s.count + s.skipped > 0) && (
        <div className="rounded-2xl border border-line bg-surface/80 p-3">
          <p className="mb-2 text-sm font-semibold">Split balance · last 30 days</p>
          <ul className="flex flex-col gap-2">
            {split.map((s) => (
              <li key={s.day} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate text-muted">{s.day}</span>
                <span className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-raised">
                  {s.count > 0 && <span className="h-full rounded-full bg-accent" style={{ width: `${(s.count / maxSplit) * 100}%` }} />}
                </span>
                <span className="tabular-nums">
                  <span className="font-semibold">{s.count}×</span>
                  {s.skipped > 0 && <span className="text-faint"> · {s.skipped} skipped</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
