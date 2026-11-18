"use client";

/** One Inbox item: what you said, what it'll become, and Approve / Edit / Dismiss. */
import { useState, useTransition } from "react";
import { approveAllCleanAction, approveInboxAction, dismissInboxAction } from "@/app/(app)/inbox/actions";
import { ColorDot, cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export type InboxCardData = {
  id: string;
  rawText: string;
  source: string;
  type: string;
  title: string;
  classId: string | null;
  className: string | null;
  classColor: string | null;
  dueDate: string | null;
  dueTime: string | null;
  dueText: string | null;
  problems: string[];
  saveable: boolean;
};

const SOURCE_LABEL: Record<string, string> = { shortcut: "iPhone", mcp: "Claude", syllabus: "Syllabus", quick_add: "Quick add" };

export function InboxCard({ item }: { item: InboxCardData }) {
  const sheet = useTaskSheet();
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const r = await action();
      if (r.ok) {
        setGone(true);
        sheet.toast(done);
      } else sheet.toast(`Couldn't do that: ${r.error}`);
    });
  }

  if (gone) return null;
  return (
    <li className={cx("fade-in flex flex-col gap-3 rounded-2xl border bg-raised/70 p-4", item.problems.length ? "border-warn/40 shadow-glow-warn" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted italic">“{item.rawText}”</p>
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] tracking-wide text-faint uppercase">
          {SOURCE_LABEL[item.source] ?? item.source}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {item.classColor && <ColorDot color={item.classColor} />}
        <span className="font-medium">
          {item.className ? `${item.className}: ` : ""}
          {item.title}
        </span>
        {item.dueText && <span className="ml-auto shrink-0 text-xs text-accent">{item.dueText}</span>}
      </div>
      {!item.saveable && <p className="text-xs text-faint">Type: {item.type}</p>}

      {item.problems.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-warn">
          {item.problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        {item.saveable && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveInboxAction(item.id), "Approved ✓")}
            className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-glow transition active:scale-95 disabled:opacity-40"
          >
            Approve
          </button>
        )}
        {item.saveable && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              sheet.openNew({ title: item.title, classId: item.classId, dueDate: item.dueDate, dueTime: item.dueTime, inboxId: item.id })
            }
            className="rounded-xl border border-line bg-raised px-3 py-2 text-sm font-semibold text-ink transition active:scale-95"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => dismissInboxAction(item.id), "Dismissed")}
          className="rounded-xl px-3 py-2 text-sm text-muted transition hover:text-ink active:scale-95"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

export function ApproveAllButton({ count, batchId, label }: { count: number; batchId?: string; label?: string }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await approveAllCleanAction(batchId);
          sheet.toast(r.ok ? `Approved ${r.count ?? 0} ✓` : `Couldn't approve: ${r.error}`);
        })
      }
      className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-40"
    >
      {pending ? "Approving…" : (label ?? `Approve all ${count} ✓`)}
    </button>
  );
}
