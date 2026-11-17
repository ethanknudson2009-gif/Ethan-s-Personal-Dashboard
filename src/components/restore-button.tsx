"use client";

import { useTransition } from "react";
import { restoreAction } from "@/app/(app)/inbox/actions";
import { useTaskSheet } from "@/components/task-sheet";

export function RestoreButton({ kind, id }: { kind: "task" | "class"; id: string }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await restoreAction(kind, id);
          sheet.toast(r.ok ? "Restored ✓" : `Couldn't restore: ${r.error}`);
        })
      }
      className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-40"
    >
      Restore
    </button>
  );
}
