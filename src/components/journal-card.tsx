"use client";

/**
 * Today's journal: tap a mood, write (or talk) a few lines. It saves itself
 * a moment after you stop typing. Below: the last 7 days of moods.
 */
import { useEffect, useRef, useState } from "react";
import { saveJournalAction } from "@/app/(app)/life/actions";
import { useSpeech } from "@/lib/use-speech";
import { IconMic } from "@/components/icons";
import { cx, inputClass } from "@/components/ui";

export const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const PROMPTS = ["What went well today?", "What's on your mind?", "One thing you're grateful for?", "What would make tomorrow great?"];

export function JournalCard({
  today,
  initialMood,
  initialBody,
  week,
}: {
  today: string;
  initialMood: number | null;
  initialBody: string;
  week: { date: string; label: string; mood: number | null; hasText: boolean }[];
}) {
  const [mood, setMood] = useState<number | null>(initialMood);
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | null>(null);
  const first = useRef(true);
  const prompt = PROMPTS[Number(today.slice(8)) % PROMPTS.length];
  const speech = useSpeech((heard, final) => {
    if (final) setBody((b) => (b ? `${b.trimEnd()} ${heard[0]}` : heard[0]));
  });

  // Save a moment after the last change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setState("saving");
      const r = await saveJournalAction(today, mood, body);
      setState(r.ok ? "saved" : "idle");
    }, 800);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [mood, body, today]);

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/85 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Journal · today</h2>
        <span className="text-[11px] text-faint">{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : ""}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={cx(
              "flex flex-col items-center gap-0.5 rounded-2xl border py-2 transition active:scale-90",
              mood === m.value ? "border-accent bg-accent/15 shadow-glow" : "border-line bg-raised/60",
            )}
          >
            <span className={cx("text-2xl transition", mood === m.value ? "scale-110" : mood ? "opacity-50" : "")}>{m.emoji}</span>
            <span className="text-[10px] text-muted">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={prompt}
          rows={4}
          className={cx(inputClass, "w-full resize-none pr-12 text-sm leading-relaxed")}
        />
        <button
          type="button"
          onClick={() => (speech.listening ? speech.stop() : speech.start())}
          aria-label={speech.listening ? "Stop" : "Talk"}
          className={cx(
            "absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full transition",
            speech.listening ? "mic-live bg-accent text-accent-ink" : "bg-raised text-accent",
          )}
        >
          <IconMic size={18} />
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] tracking-wider text-faint uppercase">Last 7 days</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {week.map((d) => {
            const m = d.date === today ? mood : d.mood;
            return (
              <div key={d.date} className="flex flex-col items-center gap-0.5">
                <span className={cx("text-lg", !m && "opacity-25 grayscale")}>{m ? MOODS[m - 1].emoji : "·"}</span>
                <span className={cx("text-[10px]", d.date === today ? "font-bold text-accent" : "text-faint")}>{d.label}</span>
                {d.hasText && d.date !== today && <span className="h-1 w-1 rounded-full bg-muted" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
