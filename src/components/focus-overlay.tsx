"use client";

/**
 * Focus mode: a full-screen glowing countdown for one task. Minimize it to
 * a small pill above the bottom bar and keep using the app. When time's
 * up: a soft chime, the minutes are logged to the task, and a toast.
 */
import { useEffect, useState } from "react";
import { logFocusAction } from "@/app/(app)/tasks/actions";
import { clock, minutesDone, msLeft } from "@/lib/focus";
import { focusStore, useFocusSession } from "@/lib/focus-store";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

/** A short, soft two-note chime made in the browser (no sound files). */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {
    // No audio available: the toast still shows.
  }
}

export function FocusOverlay() {
  const session = useFocusSession();
  const sheet = useTaskSheet();
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(true);

  // Tick twice a second while a session is running.
  useEffect(() => {
    if (!session || session.pausedLeft !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [session]);

  const left = session ? msLeft(session, now) : 0;
  const finished = Boolean(session && session.pausedLeft === null && left <= 0);

  // Time's up: log the minutes and celebrate.
  useEffect(() => {
    if (!finished || !session) return;
    const done = session.minutes;
    focusStore.clear();
    chime();
    void logFocusAction(session.taskId, done);
    sheet.toast(`Focus done ✓ ${done} min on ${session.title}`);
  }, [finished, session, sheet]);

  if (!session) return null;

  function stop() {
    if (!session) return;
    const done = minutesDone(session, Date.now());
    focusStore.clear();
    if (done > 0) {
      void logFocusAction(session.taskId, done);
      sheet.toast(`Logged ${done} min on ${session.title}`);
    }
  }

  const paused = session.pausedLeft !== null;
  const progress = 1 - left / (session.minutes * 60_000);
  const color = session.color ?? "var(--color-accent)";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fade-in fixed bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/50 bg-surface/95 px-4 py-2 text-sm font-semibold shadow-glow backdrop-blur md:bottom-8"
      >
        <span className={cx("h-2 w-2 rounded-full bg-accent", !paused && "animate-pulse")} />
        Focus {clock(left)}
      </button>
    );
  }

  const size = 248;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <div className="fade-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-bg/95 p-6 backdrop-blur-xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Focus</p>
      <p className="max-w-sm text-center font-display text-xl font-semibold text-balance">{session.title}</p>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={10} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: "stroke-dashoffset 500ms linear", filter: `drop-shadow(0 0 10px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-6xl font-semibold tabular-nums">{clock(left)}</span>
          <span className="mt-1 text-sm text-muted">{paused ? "Paused" : "Stay with it"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => (paused ? focusStore.resume() : focusStore.pause())}
          className="rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink shadow-glow transition active:scale-95"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => focusStore.add(5)} className="rounded-2xl border border-line bg-raised px-4 py-3 font-semibold transition active:scale-95">
          +5 min
        </button>
        <button type="button" onClick={stop} className="rounded-2xl px-4 py-3 text-muted transition hover:text-ink active:scale-95">
          Stop
        </button>
      </div>
      <button type="button" onClick={() => setExpanded(false)} className="text-sm text-faint underline-offset-4 hover:text-muted hover:underline">
        Minimize and keep using the app
      </button>
    </div>
  );
}
