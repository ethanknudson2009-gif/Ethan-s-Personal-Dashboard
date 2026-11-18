"use client";

import { useState, useTransition } from "react";
import { createHabitAction } from "@/app/(app)/life/actions";
import { Button, Chip, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const COLORS = ["#2ee6c9", "#5b8cff", "#a78bfa", "#f472b6", "#ffb547", "#3ddc97", "#ff4d6d"];
const FREQUENCIES = [
  { label: "Every day", times: 1, per: "day" as const },
  { label: "5× a week", times: 5, per: "week" as const },
  { label: "3× a week", times: 3, per: "week" as const },
  { label: "Once a week", times: 1, per: "week" as const },
];
const IDEAS = [
  { name: "Read 20 min", emoji: "📖" },
  { name: "Gym", emoji: "🏋️" },
  { name: "Stretch", emoji: "🧘" },
  { name: "Drink water", emoji: "💧" },
  { name: "Practice choir", emoji: "🎵" },
];

/** Add a habit in a few taps: name (or pick an idea), how often, color. */
export function NewHabit({ open: startOpen = false }: { open?: boolean }) {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [freq, setFreq] = useState(0);
  const [color, setColor] = useState(COLORS[0]);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-3xl border border-dashed border-line px-4 py-4 text-sm font-semibold text-muted transition hover:border-accent/60 hover:text-accent"
      >
        + New habit
      </button>
    );
  }

  return (
    <form
      className="fade-in flex flex-col gap-4 rounded-3xl border border-accent/40 bg-surface/90 p-4 shadow-glow"
      onSubmit={(e) => {
        e.preventDefault();
        const f = FREQUENCIES[freq];
        startTransition(async () => {
          const r = await createHabitAction({ name, emoji, color, times: f.times, per: f.per });
          if (!r.ok) return sheet.toast(r.error);
          sheet.toast(`${emoji || "✓"} ${name} added`);
          setName("");
          setEmoji("");
          setOpen(false);
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          aria-label="Emoji (optional)"
          maxLength={8}
          className={cx(inputClass, "w-14 text-center")}
        />
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New habit, e.g. Read 20 min" className={cx(inputClass, "min-w-0 flex-1")} maxLength={60} />
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {IDEAS.map((i) => (
          <Chip
            key={i.name}
            onClick={() => {
              setName(i.name);
              setEmoji(i.emoji);
            }}
          >
            {i.emoji} {i.name}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FREQUENCIES.map((f, i) => (
          <Chip key={f.label} active={freq === i} onClick={() => setFreq(i)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={cx("h-8 w-8 rounded-full transition active:scale-90", color === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
            style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()} className="flex-1 py-3">
          {pending ? "Adding…" : "Add habit"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
