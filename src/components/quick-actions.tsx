"use client";

import { IconMic, IconPlus } from "@/components/icons";
import { useTaskSheet } from "@/components/task-sheet";

/** Big "Talk" and "Type" buttons in the Today hero: the fastest way in. */
export function QuickActions() {
  const sheet = useTaskSheet();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => sheet.openVoice()}
        data-silent
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-glow transition active:scale-[0.97]"
      >
        <IconMic size={18} strokeWidth={2.2} /> Talk
      </button>
      <button
        type="button"
        onClick={() => sheet.openNew()}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-raised/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent/50 active:scale-[0.97]"
      >
        <IconPlus size={18} strokeWidth={2.2} /> Type
      </button>
    </div>
  );
}
