"use client";

import { IconPlus } from "@/components/icons";
import { useTaskSheet } from "@/components/task-sheet";

/** Small "+ Add" button for page headers on laptops (phones use the bottom bar's "+"). */
export function AddButton() {
  const sheet = useTaskSheet();
  return (
    <button
      type="button"
      onClick={() => sheet.openNew()}
      className="hidden items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 md:flex"
    >
      <IconPlus size={16} /> Add
    </button>
  );
}
