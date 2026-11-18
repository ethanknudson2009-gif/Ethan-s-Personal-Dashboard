import { createClient } from "@/lib/supabase/server";
import { readDraft, SAVEABLE_TYPES } from "@/lib/capture";
import { formatLocalDate, formatTimeOfDay } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { ApproveAllButton, InboxCard, type InboxCardData } from "@/components/inbox-card";

/**
 * Inbox: things captured from your iPhone, Claude or a syllabus wait here
 * for a one-tap review before they're saved (nothing wrong sneaks in).
 */
export default async function InboxPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: classes }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("id, raw_text, draft, type, problems, source, created_at, batch_id")
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, color").is("deleted_at", null),
  ]);
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));

  const cards: (InboxCardData & { batchId: string | null })[] = (items ?? []).map((i) => {
    const d = readDraft(i.draft);
    const cls = d?.classId ? classById.get(d.classId) : undefined;
    return {
      id: i.id,
      rawText: i.raw_text,
      source: i.source,
      type: d?.type ?? i.type,
      title: d?.title || i.raw_text,
      classId: cls ? cls.id : null,
      className: cls?.name ?? null,
      classColor: cls?.color ?? null,
      dueDate: d?.dueDate ?? null,
      dueTime: d?.dueTime ?? null,
      dueText: d?.dueDate ? `${formatLocalDate(d.dueDate)}${d.dueTime ? ` · ${formatTimeOfDay(d.dueTime)}` : ""}` : null,
      problems: i.problems,
      saveable: Boolean(d && SAVEABLE_TYPES.includes(d.type)),
      batchId: i.batch_id,
    };
  });

  // Group: single captures first, then each syllabus import as its own batch.
  const singles = cards.filter((c) => !c.batchId);
  const batches = new Map<string, typeof cards>();
  for (const c of cards) if (c.batchId) batches.set(c.batchId, [...(batches.get(c.batchId) ?? []), c]);
  const clean = cards.filter((c) => c.saveable && c.problems.length === 0).length;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Inbox" subtitle="Review before saving">
        <ApproveAllButton count={clean} />
      </PageHeader>
      {cards.length === 0 ? (
        <EmptyState>
          Inbox zero. Things you capture from your iPhone or Claude show up here for a quick check before they&apos;re saved.
        </EmptyState>
      ) : (
        <>
          {singles.length > 0 && (
            <ul className="rows flex flex-col gap-3">
              {singles.map((c) => (
                <InboxCard key={c.id} item={c} />
              ))}
            </ul>
          )}
          {[...batches.entries()].map(([batchId, items]) => {
            const cls = items.find((i) => i.className)?.className;
            const clean = items.filter((i) => i.saveable && i.problems.length === 0).length;
            return (
              <section key={batchId} className="flex flex-col gap-3 rounded-3xl border border-electric/30 bg-electric/5 p-3">
                <header className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-electric uppercase">From a syllabus</p>
                    <p className="font-display text-lg font-semibold">
                      {cls ?? "Imported"} · {items.length} item{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ApproveAllButton count={clean} batchId={batchId} label={`Approve ${clean} ✓`} />
                </header>
                <ul className="rows flex flex-col gap-2">
                  {items.map((c) => (
                    <InboxCard key={c.id} item={c} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
