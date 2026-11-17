import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { RestoreButton } from "@/components/restore-button";

const DAY = 86_400_000;

type TrashRow = { kind: "task" | "class"; id: string; label: string; deletedAt: string; daysLeft: number };

/** Everything in the Trash, newest first, with how many days until it's removed. */
async function loadTrash(): Promise<TrashRow[]> {
  const supabase = await createClient();
  const [{ data: tasks }, { data: classes }] = await Promise.all([
    supabase.from("tasks").select("id, title, deleted_at").not("deleted_at", "is", null),
    supabase.from("classes").select("id, name, deleted_at").not("deleted_at", "is", null),
  ]);
  const now = Date.now();
  const daysLeft = (deletedAt: string) => Math.max(0, 7 - Math.floor((now - new Date(deletedAt).getTime()) / DAY));
  return [
    ...(classes ?? []).map((c) => ({ kind: "class" as const, id: c.id, label: `Class · ${c.name}`, deletedAt: c.deleted_at!, daysLeft: daysLeft(c.deleted_at!) })),
    ...(tasks ?? []).map((t) => ({ kind: "task" as const, id: t.id, label: t.title, deletedAt: t.deleted_at!, daysLeft: daysLeft(t.deleted_at!) })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Trash: deleted things stay here for 7 days, then are removed for good. */
export default async function TrashPage() {
  const rows = await loadTrash();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Trash" subtitle="Kept for 7 days" />
      {rows.length === 0 ? (
        <EmptyState>Trash is empty.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-raised/70 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-muted line-through">{r.label}</p>
                <p className="text-xs text-faint">
                  {r.daysLeft === 0 ? "Removed tonight" : `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} left`}
                </p>
              </div>
              <RestoreButton kind={r.kind} id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
