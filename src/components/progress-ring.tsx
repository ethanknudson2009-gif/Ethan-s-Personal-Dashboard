"use client";

import { useEffect, useState } from "react";

/**
 * A glowing ring that fills up as you check things off today. It animates
 * from empty on first load, so the progress "draws itself".
 */
export function ProgressRing({ done, total, size = 92 }: { done: number; total: number; size?: number }) {
  const [shown, setShown] = useState(0);
  const ratio = total === 0 ? 1 : done / total;
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(ratio));
    return () => cancelAnimationFrame(id);
  }, [ratio]);

  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ filter: "drop-shadow(0 0 6px rgb(46 230 201 / 0.7))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {total === 0 ? (
          <span className="font-display text-2xl font-semibold text-accent">✓</span>
        ) : (
          <>
            <span className="font-display text-xl font-semibold">
              {done}/{total}
            </span>
            <span className="mt-1 text-[10px] tracking-wider text-muted uppercase">done</span>
          </>
        )}
      </div>
    </div>
  );
}
