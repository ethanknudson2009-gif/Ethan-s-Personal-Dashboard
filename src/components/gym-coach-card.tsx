"use client";

/** The Coach card on the Gym page: the top tips from your logged sets, the rest one tap away. */
import { useState } from "react";
import type { Tip } from "@/lib/gym-coach";

const TONE: Record<Tip["tone"], string> = {
  up: "#ff6b4a",
  down: "#5b8cff",
  warn: "#c98420",
  good: "#15a690",
  info: "var(--color-muted)",
};

export function CoachCard({ tips }: { tips: Tip[] }) {
  const [all, setAll] = useState(false);
  if (!tips.length) return null;
  const shown = all ? tips : tips.slice(0, 3);
  return (
    <section className="rounded-3xl border border-line bg-surface/85 p-4 shadow-card">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">🧠 Coach</h2>
        <span className="text-[11px] text-faint">from every set you&apos;ve logged</span>
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((t) => (
          <li key={t.id} className="flex gap-3 rounded-2xl border border-line bg-raised/60 p-3" style={{ borderLeft: `3px solid ${TONE[t.tone]}` }}>
            <span className="text-xl leading-none" aria-hidden="true">
              {t.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.why}</p>
            </div>
          </li>
        ))}
      </ul>
      {tips.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 w-full rounded-xl py-2 text-xs font-semibold text-muted">
          {all ? "Show less" : `Show ${tips.length - 3} more tip${tips.length - 3 === 1 ? "" : "s"}`}
        </button>
      )}
    </section>
  );
}
