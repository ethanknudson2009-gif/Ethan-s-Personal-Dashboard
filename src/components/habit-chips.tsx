"use client";

/** Today's habits as tappable chips on the Today page: one tap to check in. */
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleCheckinAction } from "@/app/(app)/life/actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export type HabitChip = { id: string; name: string; emoji: string | null; color: string; done: boolean };

export function HabitChips({ habits, today }: { habits: HabitChip[]; today: string }) {
  const sheet = useTaskSheet();
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(new Set(habits.filter((h) => h.done).map((h) => h.id)));

  return (
    <section className="rounded-3xl border border-line bg-surface/85 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
          Habits · {done.size}/{habits.length}
        </h2>
        <Link href="/life" className="text-xs font-medium text-accent">
          Open Life →
        </Link>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {habits.map((h) => {
          const on = done.has(h.id);
          return (
            <button
              key={h.id}
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const next = new Set(done);
                  if (on) next.delete(h.id);
                  else next.add(h.id);
                  setDone(next);
                  const r = await toggleCheckinAction(h.id, today);
                  if (!r.ok) sheet.toast(`Couldn't save: ${r.error}`);
                  else if (!on) sheet.toast(`${h.emoji ?? "✓"} ${h.name} done`);
                })
              }
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition active:scale-95",
                on ? "text-accent-ink" : "border-line bg-raised text-ink",
              )}
              style={on ? { backgroundColor: h.color, borderColor: h.color, boxShadow: `0 0 14px -2px ${h.color}` } : undefined}
            >
              <span>{on ? "✓" : (h.emoji ?? "○")}</span>
              {h.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
