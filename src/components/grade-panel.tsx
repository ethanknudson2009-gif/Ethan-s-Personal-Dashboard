"use client";

/**
 * One class on the Grades page: big letter grade, then (tap to open) the
 * categories, the scores, a what-if mode, and "what do I need?".
 */
import { useState, useTransition } from "react";
import { addCategoryAction, addGradeAction, deleteCategoryAction, deleteGradeAction } from "@/app/(app)/grades/actions";
import { average, formatPercent, letter, neededFor, type Category, type Grade } from "@/lib/grades";
import { Button, Chip, ColorDot, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export type GradeRow = { id: string; title: string; categoryId: string | null; earned: number; possible: number; whatIf: boolean };
export type CategoryRow = { id: string; name: string; weight: number };

const TONE = (l: string) =>
  l.startsWith("A") ? "text-ok" : l.startsWith("B") ? "text-accent" : l.startsWith("C") ? "text-warn" : l === "—" ? "text-faint" : "text-danger";

const TARGETS = [
  { label: "A", pct: 93 },
  { label: "A-", pct: 90 },
  { label: "B", pct: 83 },
  { label: "C", pct: 73 },
];

export function GradePanel({
  cls,
  categories,
  grades,
}: {
  cls: { id: string; name: string; color: string };
  categories: CategoryRow[];
  grades: GradeRow[];
}) {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const cats: Category[] = categories.map((c) => ({ id: c.id, weight: c.weight }));
  const gs: Grade[] = grades.map((g) => ({ categoryId: g.categoryId, earned: g.earned, possible: g.possible, whatIf: g.whatIf }));
  const real = average(cats, gs);
  const withWhatIf = grades.some((g) => g.whatIf) ? average(cats, gs, true) : null;
  const L = letter(real);
  const weightTotal = categories.reduce((s, c) => s + c.weight, 0);

  // Forms
  const [g, setG] = useState({ title: "", categoryId: categories[0]?.id ?? "", earned: "", possible: "100", whatIf: false });
  const [c, setC] = useState({ name: "", weight: "" });
  const [need, setNeed] = useState({ target: 90, categoryId: categories[0]?.id ?? "", possible: "100" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return sheet.toast(r.error ?? "Couldn't save");
      sheet.toast(done);
      after?.();
    });

  const needed = need.possible ? neededFor(need.target, cats, gs, need.categoryId || null, Number(need.possible)) : null;

  return (
    <li className={cx("overflow-hidden rounded-3xl border bg-raised/70 transition", open ? "border-accent/40 shadow-glow" : "border-line")}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left">
        <ColorDot color={cls.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{cls.name}</p>
          <p className="text-xs text-muted">
            {real === null ? "No grades yet" : `${formatPercent(real)} · ${grades.filter((x) => !x.whatIf).length} graded`}
            {withWhatIf !== null && <span className="text-electric"> · what-if {formatPercent(withWhatIf)}</span>}
          </p>
        </div>
        <span className={cx("font-display text-3xl font-bold", TONE(L))} style={{ textShadow: "0 0 18px currentColor" }}>
          {L}
        </span>
      </button>

      {open && (
        <div className="fade-in flex flex-col gap-5 border-t border-line p-4">
          {/* Categories */}
          <section>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
              Categories {categories.length > 0 && <span className={weightTotal === 100 ? "text-ok" : "text-warn"}>· {weightTotal}%</span>}
            </p>
            {categories.length === 0 && <p className="mb-2 text-xs text-faint">Optional. Add them if your teacher weights grades (e.g. Tests 50%, Homework 30%).</p>}
            <div className="mb-2 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span key={cat.id} className="flex items-center gap-1.5 rounded-full border border-line bg-bg/40 px-3 py-1 text-xs">
                  {cat.name} · {cat.weight}%
                  <button type="button" aria-label={`Remove ${cat.name}`} onClick={() => run(() => deleteCategoryAction(cat.id), "Category removed")} className="text-faint hover:text-danger">
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => addCategoryAction({ classId: cls.id, name: c.name, weight: Number(c.weight) }), "Category added", () => setC({ name: "", weight: "" }));
              }}
            >
              <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Tests" className={cx(inputClass, "min-w-0 flex-1")} />
              <input value={c.weight} onChange={(e) => setC({ ...c, weight: e.target.value })} placeholder="%" inputMode="decimal" className={cx(inputClass, "w-16")} />
              <Button type="submit" variant="secondary" disabled={pending || !c.name || c.weight === ""}>
                Add
              </Button>
            </form>
          </section>

          {/* Scores */}
          <section>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Scores</p>
            <ul className="mb-3 flex flex-col gap-1.5">
              {grades.map((gr) => (
                <li
                  key={gr.id}
                  className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", gr.whatIf ? "border-dashed border-electric/50 bg-electric/5" : "border-line bg-bg/40")}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {gr.whatIf && <span className="text-electric">what-if · </span>}
                    {gr.title}
                    {gr.categoryId && <span className="text-faint"> · {categories.find((x) => x.id === gr.categoryId)?.name}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {gr.earned}/{gr.possible} <span className="text-faint">({Math.round((gr.earned / gr.possible) * 100)}%)</span>
                  </span>
                  <button type="button" aria-label={`Delete ${gr.title}`} onClick={() => run(() => deleteGradeAction(gr.id), "Removed")} className="shrink-0 text-faint hover:text-danger">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    addGradeAction({
                      classId: cls.id,
                      categoryId: g.categoryId || null,
                      title: g.title,
                      earned: Number(g.earned),
                      possible: Number(g.possible),
                      whatIf: g.whatIf,
                    }),
                  g.whatIf ? "What-if added" : "Score added ✓",
                  () => setG({ ...g, title: "", earned: "" }),
                );
              }}
            >
              <input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="Chapter 3 quiz" className={inputClass} />
              <div className="flex gap-2">
                <input value={g.earned} onChange={(e) => setG({ ...g, earned: e.target.value })} placeholder="Got" inputMode="decimal" className={cx(inputClass, "w-20")} />
                <span className="self-center text-muted">/</span>
                <input value={g.possible} onChange={(e) => setG({ ...g, possible: e.target.value })} placeholder="Out of" inputMode="decimal" className={cx(inputClass, "w-20")} />
                {categories.length > 0 && (
                  <select value={g.categoryId} onChange={(e) => setG({ ...g, categoryId: e.target.value })} className={cx(inputClass, "min-w-0 flex-1")}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Chip active={g.whatIf} onClick={() => setG({ ...g, whatIf: !g.whatIf })}>
                  🔮 What-if
                </Chip>
                <Button type="submit" disabled={pending || !g.title || g.earned === "" || !g.possible} className="ml-auto">
                  Add score
                </Button>
              </div>
            </form>
          </section>

          {/* What do I need? */}
          {real !== null && (
            <section className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-accent uppercase">What do I need?</p>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                {TARGETS.map((t) => (
                  <Chip key={t.label} active={need.target === t.pct} onClick={() => setNeed({ ...need, target: t.pct })}>
                    {t.label} ({t.pct}%)
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                on a next
                <input value={need.possible} onChange={(e) => setNeed({ ...need, possible: e.target.value })} inputMode="decimal" className={cx(inputClass, "w-20")} />
                point
                {categories.length > 0 ? (
                  <select value={need.categoryId} onChange={(e) => setNeed({ ...need, categoryId: e.target.value })} className={cx(inputClass, "min-w-0")}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  "assignment"
                )}
              </div>
              <p className="mt-3 font-display text-lg font-semibold">
                {needed === null
                  ? "Not reachable with one assignment. Talk to your teacher about extra credit."
                  : needed === 0
                    ? "You're set even with a 0. 🎉"
                    : `You need ${needed} / ${need.possible} (${Math.ceil((needed / Number(need.possible)) * 100)}%)`}
              </p>
            </section>
          )}
        </div>
      )}
    </li>
  );
}
