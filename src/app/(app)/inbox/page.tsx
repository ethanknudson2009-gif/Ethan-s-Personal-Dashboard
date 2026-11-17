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
      .select("id, raw_text, draft, type, problems, source, created_at")
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, color").is("deleted_at", null),
  ]);
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));

  const cards: InboxCardData[] = (items ?? []).map((i) => {
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
    };
  });
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
        <ul className="rows flex flex-col gap-3">
          {cards.map((c) => (
            <InboxCard key={c.id} item={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
