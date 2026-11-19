"use client";

/**
 * The bar that opens when you tap a task reminder (the notification links
 * to /today?task=<id>). iPhone doesn't show buttons on notifications, so
 * Done and Snooze live here instead: one tap and it's handled.
 */
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { completeTaskAction, snoozeTaskAction } from "@/app/(app)/tasks/actions";
import { snoozedText } from "@/lib/tasks/view";
import { Chip } from "@/components/ui";
import { IconClose } from "@/components/icons";

type Choice = "1h" | "3h" | "tonight" | "tomorrow";
const CHOICES: { value: Choice; label: string }[] = [
  { value: "1h", label: "1 hr" },
  { value: "3h", label: "3 hr" },
  { value: "tonight", label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
];

export function SnoozeBar({ tasks }: { tasks: { id: string; title: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const id = params.get("task");
  const task = tasks.find((t) => t.id === id);
  if (!id) return null;

  const close = () => router.replace(path, { scroll: false });
  if (!task && !message) return null; // already done or deleted

  const run = (work: () => Promise<{ ok: boolean; error?: string; until?: string }>, done: (r: { until?: string }) => string) =>
    startTransition(async () => {
      const r = await work();
      if (!r.ok) return setMessage(r.error ?? "Couldn't do that");
      setMessage(done(r));
      setTimeout(close, 1400);
    });

  return (
    <div role="status" className="rounded-2xl border border-electric/40 bg-electric/10 p-3 shadow-glow">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{message ?? `⏰ ${task?.title}`}</p>
        <button type="button" onClick={close} aria-label="Close" className="text-muted hover:text-ink">
          <IconClose size={16} />
        </button>
      </div>
      {!message && task && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip active disabled={pending} onClick={() => run(() => completeTaskAction(task.id), () => "Done ✓ +10 XP")}>
            Done ✓
          </Chip>
          <span className="text-xs text-muted">Snooze:</span>
          {CHOICES.map((c) => (
            <Chip
              key={c.value}
              disabled={pending}
              onClick={() =>
                run(
                  () => snoozeTaskAction(task.id, c.value),
                  (r) => `Snoozed until ${snoozedText(r.until, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)?.slice(2) ?? "later"} ✓`,
                )
              }
            >
              {c.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
