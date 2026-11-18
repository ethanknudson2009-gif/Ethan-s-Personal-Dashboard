"use client";

import { useTransition } from "react";
import { removeFileAction } from "@/app/(app)/classes/file-actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const STATUS: Record<string, { label: string; style: string }> = {
  text_ready: { label: "Ready for Claude", style: "text-accent" },
  needs_claude: { label: "Scan: attach in Claude", style: "text-warn" },
  imported: { label: "Imported ✓", style: "text-ok" },
  uploaded: { label: "Uploaded", style: "text-muted" },
};

/** One uploaded file under a class: open it, see its status, or remove it. */
export function FileChip({ id, filename, status, url }: { id: string; filename: string; status: string; url: string | null }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const s = STATUS[status] ?? STATUS.uploaded;
  return (
    <li className={cx("flex items-center gap-2 rounded-xl border border-line bg-bg/40 px-2.5 py-1.5 text-xs", pending && "opacity-40")}>
      <span aria-hidden="true">📄</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">
          {filename}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate font-medium">{filename}</span>
      )}
      <span className={cx("shrink-0", s.style)}>{s.label}</span>
      <button
        type="button"
        aria-label={`Remove ${filename}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove "${filename}"? This deletes the file for good.`)) return;
          startTransition(async () => {
            const r = await removeFileAction(id);
            sheet.toast(r.ok ? "File removed" : `Couldn't remove: ${r.error}`);
          });
        }}
        className="shrink-0 rounded-md px-1.5 text-faint hover:text-danger"
      >
        ✕
      </button>
    </li>
  );
}
