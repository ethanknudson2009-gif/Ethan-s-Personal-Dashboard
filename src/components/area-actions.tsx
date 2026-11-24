"use client";

import { IconMic, IconPlus } from "@/components/icons";
import { useTaskSheet, type Area } from "@/components/task-sheet";
import { cx } from "@/components/ui";

/** Talk / Type buttons that already know which area the new task is for. */
export function AreaActions({ area, tone }: { area: Area; tone: "work" | "money" | "accent" }) {
  const sheet = useTaskSheet();
  const main = {
    work: "bg-warn text-[#2a1600] glow-work",
    money: "bg-ok text-[#032016] glow-money",
    accent: "bg-accent text-accent-ink shadow-glow",
  }[tone];
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => sheet.openVoice({ area })}
        data-silent
        className={cx("flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.97]", main)}
      >
        <IconMic size={18} strokeWidth={2.2} /> Talk
      </button>
      <button
        type="button"
        onClick={() => sheet.openNew({ area })}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-raised/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-muted active:scale-[0.97]"
      >
        <IconPlus size={18} strokeWidth={2.2} /> Type
      </button>
    </div>
  );
}
