"use client";

/**
 * Morning Plan (1 minute) and Evening Shutdown (2 minutes), one step at a
 * time so it never feels like a form.
 *
 * Morning: 1. today at a glance → 2. pick your top 3 → 3. one line on what
 * would make today a win.
 * Evening: 1. check off what got done → 2. push the rest to tomorrow →
 * 3. how was today? → done.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { completeTaskAction, reopenTaskAction } from "@/app/(app)/tasks/actions";
import { finishShutdownAction, moveToTomorrowAction, savePlanAction } from "@/app/(app)/plan/actions";
import { Button, ColorDot, cx, inputClass } from "@/components/ui";
import { MOODS } from "@/lib/moods";

export type PlanItem = { id: string; title: string; dueText: string | null; overdue: boolean; color: string | null };
export type PlanClass = { name: string; color: string; time: string };

export function DayPlan(props: {
  start: "morning" | "evening";
  classes: PlanClass[];
  candidates: PlanItem[];
  suggested: string[];
  plannedFocus: string[] | null;
  intention: string | null;
  left: PlanItem[];
  doneToday: number;
  dueToday: number;
  dueTomorrow: number;
  shutDown: boolean;
}) {
  const [mode, setMode] = useState(props.start);
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 self-start rounded-2xl border border-line bg-surface p-1">
        {(["morning", "evening"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx("rounded-xl px-3 py-1.5 text-sm font-semibold transition", mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-ink")}
          >
            {m === "morning" ? "☀️ Morning plan" : "🌙 Evening shutdown"}
          </button>
        ))}
      </div>
      {mode === "morning" ? <Morning {...props} /> : <Evening {...props} />}
    </div>
  );
}

function Steps({ at, count }: { at: number; count: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${at + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cx("h-1.5 flex-1 rounded-full transition", i <= at ? "bg-accent" : "bg-line")} />
      ))}
    </div>
  );
}

function StepCard({ step, count, title, hint, children }: { step: number; count: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/80 p-5">
      <Steps at={step} count={count} />
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ item, on, onClick, mark }: { item: PlanItem; on: boolean; onClick: () => void; mark: "pick" | "check" | "move" }) {
  const icon = on ? (mark === "check" ? "✓" : mark === "move" ? "→" : "★") : "";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={cx(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99]",
          on ? "border-accent/60 bg-accent/10" : "border-line bg-raised/70 hover:border-muted",
        )}
      >
        <span
          className={cx(
            "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
            on ? "border-accent bg-accent text-accent-ink" : "border-line",
          )}
        >
          {icon}
        </span>
        {item.color && <ColorDot color={item.color} />}
        <span className={cx("min-w-0 flex-1 text-sm font-medium", mark === "check" && on && "text-muted line-through")}>{item.title}</span>
        {item.dueText && <span className={cx("shrink-0 text-xs", item.overdue ? "text-danger" : "text-faint")}>{item.dueText}</span>}
      </button>
    </li>
  );
}

function Morning({ classes, candidates, suggested, plannedFocus, intention, dueToday }: Parameters<typeof DayPlan>[0]) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(plannedFocus ?? suggested);
  const [line, setLine] = useState(intention ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? [...p.slice(1), id] : [...p, id]));

  if (saved) {
    const top = picked.map((id) => candidates.find((c) => c.id === id)).filter(Boolean) as PlanItem[];
    return (
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-ok/40 bg-ok/5 p-6 text-center">
        <p className="text-3xl">☀️</p>
        <p className="font-display text-xl font-semibold">You&apos;ve got a plan.</p>
        {line && <p className="text-sm text-muted italic">“{line}”</p>}
        <ol className="flex w-full flex-col gap-1.5 text-left text-sm">
          {top.map((t, i) => (
            <li key={t.id} className="rounded-xl border border-line bg-raised/70 px-3 py-2">
              <span className="mr-2 font-bold text-accent">{i + 1}</span>
              {t.title}
            </li>
          ))}
        </ol>
        <Link href="/today" className="mt-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-glow">
          Go to Today
        </Link>
      </section>
    );
  }

  if (step === 0)
    return (
      <StepCard step={0} count={3} title="Here's your day" hint="A quick look before you start.">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl border border-line bg-raised/70 p-3">
            <p className="font-display text-2xl font-semibold">{dueToday}</p>
            <p className="text-xs text-muted">due today or overdue</p>
          </div>
          <div className="rounded-2xl border border-line bg-raised/70 p-3">
            <p className="font-display text-2xl font-semibold">{classes.length}</p>
            <p className="text-xs text-muted">{classes.length === 1 ? "class" : "classes"} today</p>
          </div>
        </div>
        {classes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {classes.map((c) => (
              <li key={c.name + c.time} className="flex items-center gap-2 text-sm">
                <ColorDot color={c.color} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-xs text-faint">{c.time}</span>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={() => setStep(1)}>Next: pick your top 3</Button>
      </StepCard>
    );

  if (step === 1)
    return (
      <StepCard step={1} count={3} title="Pick your top 3" hint="If you only get three things done today, which ones? (Already picked the most urgent.)">
        {candidates.length === 0 ? (
          <p className="rounded-2xl border border-ok/30 bg-ok/5 p-4 text-center text-sm text-muted">Nothing due this week. A free day! 🎉</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => (
              <Row key={c.id} item={c} on={picked.includes(c.id)} onClick={() => toggle(c.id)} mark="pick" />
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep(0)}>
            Back
          </Button>
          <Button className="flex-1" onClick={() => setStep(2)}>
            Next{picked.length ? ` (${picked.length} picked)` : ""}
          </Button>
        </div>
      </StepCard>
    );

  return (
    <StepCard step={2} count={3} title="What would make today a win?" hint="One line. Optional.">
      <input
        value={line}
        onChange={(e) => setLine(e.target.value)}
        maxLength={200}
        placeholder="e.g. finish the speech outline before dinner"
        className={inputClass}
        enterKeyHint="done"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await savePlanAction({ focusIds: picked, intention: line.trim() || null });
              if (!r.ok) return setError(r.error);
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : "Start my day ☀️"}
        </Button>
      </div>
    </StepCard>
  );
}

function Evening({ left, doneToday, dueTomorrow, shutDown }: Parameters<typeof DayPlan>[0]) {
  const [step, setStep] = useState(shutDown ? 3 : 0);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [move, setMove] = useState<Set<string> | null>(null);
  const [moved, setMoved] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [line, setLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unfinished = left.filter((t) => !done.has(t.id));
  const moving = move ?? new Set(unfinished.map((t) => t.id));

  const toggleDone = (id: string) => {
    const was = done.has(id);
    setDone((d) => {
      const n = new Set(d);
      if (was) n.delete(id);
      else n.add(id);
      return n;
    });
    startTransition(async () => {
      const r = was ? await reopenTaskAction(id) : await completeTaskAction(id);
      if (!r.ok) setError(r.error);
    });
  };
  const toggleMove = (id: string) => {
    const n = new Set(moving);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMove(n);
  };

  if (step === 0)
    return (
      <StepCard step={0} count={3} title="What got done today?" hint={left.length ? "Tap anything you finished." : undefined}>
        {left.length === 0 ? (
          <p className="rounded-2xl border border-ok/30 bg-ok/5 p-4 text-center text-sm text-muted">
            Nothing left from today{doneToday ? ` — ${doneToday} done ✓` : ""}. Nice.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {left.map((t) => (
              <Row key={t.id} item={t} on={done.has(t.id)} onClick={() => toggleDone(t.id)} mark="check" />
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={() => setStep(unfinished.length ? 1 : 2)}>Next</Button>
      </StepCard>
    );

  if (step === 1)
    return (
      <StepCard step={1} count={3} title="Move the rest to tomorrow?" hint="Unticked ones stay where they are.">
        <ul className="flex flex-col gap-2">
          {unfinished.map((t) => (
            <Row key={t.id} item={t} on={moving.has(t.id)} onClick={() => toggleMove(t.id)} mark="move" />
          ))}
        </ul>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep(0)}>
            Back
          </Button>
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const ids = unfinished.filter((t) => moving.has(t.id)).map((t) => t.id);
                const r = await moveToTomorrowAction(ids);
                if (!r.ok) return setError(r.error);
                setMoved(r.moved ?? 0);
                setStep(2);
              })
            }
          >
            {moving.size ? `Move ${[...moving].filter((id) => unfinished.some((t) => t.id === id)).length} to tomorrow` : "Keep them as they are"}
          </Button>
        </div>
      </StepCard>
    );

  if (step === 2)
    return (
      <StepCard step={2} count={3} title="How was today?" hint="Goes in your journal.">
        <div className="flex justify-between gap-1">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? null : m.value)}
              aria-pressed={mood === m.value}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-2 transition active:scale-95",
                mood === m.value ? "border-accent bg-accent/15 shadow-glow" : "border-line bg-raised/70",
              )}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[11px] text-muted">{m.label}</span>
            </button>
          ))}
        </div>
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          maxLength={2000}
          placeholder="Best part of today (optional)"
          className={inputClass}
          enterKeyHint="done"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await finishShutdownAction(mood, line);
              if (!r.ok) return setError(r.error);
              setStep(3);
            })
          }
        >
          {pending ? "Saving…" : "Shut down for the day 🌙"}
        </Button>
      </StepCard>
    );

  const finished = doneToday + done.size;
  return (
    <section className="flex flex-col items-center gap-2 rounded-3xl border border-electric/40 bg-electric/5 p-6 text-center">
      <p className="text-3xl">🌙</p>
      <p className="font-display text-xl font-semibold">Shutdown complete</p>
      <p className="text-sm text-muted">
        {finished} done today{moved ? ` · ${moved} moved to tomorrow` : ""} · {dueTomorrow + moved} on tomorrow&apos;s list
      </p>
      <p className="text-sm text-muted">Done thinking about school and work for today. Rest up.</p>
      <Link href="/today" className="mt-2 rounded-xl border border-line bg-raised px-4 py-2 text-sm font-semibold">
        Back to Today
      </Link>
    </section>
  );
}
