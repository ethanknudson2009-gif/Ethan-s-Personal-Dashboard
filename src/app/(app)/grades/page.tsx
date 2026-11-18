import { createClient } from "@/lib/supabase/server";
import { average, letter, type Category, type Grade } from "@/lib/grades";
import { PageHeader } from "@/components/ui";
import { GradePanel } from "@/components/grade-panel";

/** Grades: your running grade in every class, what-ifs, and "what do I need?". */
export default async function GradesPage() {
  const supabase = await createClient();
  const [{ data: classes }, { data: categories }, { data: grades }] = await Promise.all([
    supabase.from("classes").select("id, name, color").is("deleted_at", null).eq("archived", false).order("name"),
    supabase.from("grade_categories").select("id, class_id, name, weight").order("created_at"),
    supabase.from("grades").select("id, class_id, category_id, title, points_earned, points_possible, is_what_if").order("created_at"),
  ]);

  const rows = (classes ?? []).map((c) => {
    const cats = (categories ?? []).filter((x) => x.class_id === c.id).map((x) => ({ id: x.id, name: x.name, weight: Number(x.weight) }));
    const gs = (grades ?? [])
      .filter((g) => g.class_id === c.id)
      .map((g) => ({
        id: g.id,
        title: g.title,
        categoryId: g.category_id,
        earned: Number(g.points_earned),
        possible: Number(g.points_possible),
        whatIf: g.is_what_if,
      }));
    return { cls: c, cats, gs };
  });

  // Overall: the plain average of class percentages that have grades.
  const percents = rows
    .map((r) =>
      average(
        r.cats.map((c): Category => ({ id: c.id, weight: c.weight })),
        r.gs.map((g): Grade => ({ categoryId: g.categoryId, earned: g.earned, possible: g.possible, whatIf: g.whatIf })),
      ),
    )
    .filter((p): p is number => p !== null);
  const overall = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Grades" subtitle="School" />

      <section className="hero flex items-center gap-4 rounded-3xl border border-accent/30 bg-surface/70 p-5 shadow-glow">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Overall</p>
          <p className="mt-1 font-display text-2xl font-semibold">{overall === null ? "Add your first score" : `${overall.toFixed(1)}% average`}</p>
          <p className="mt-1 text-sm text-muted">
            {overall === null ? "Tap a class below, then Add score." : `Across ${percents.length} class${percents.length === 1 ? "" : "es"} with grades.`}
          </p>
        </div>
        <span className="font-display text-5xl font-bold text-accent" style={{ textShadow: "0 0 24px currentColor" }}>
          {letter(overall)}
        </span>
      </section>

      <ul className="rows flex flex-col gap-3">
        {rows.map((r) => (
          <GradePanel key={r.cls.id} cls={r.cls} categories={r.cats} grades={r.gs} />
        ))}
      </ul>
    </div>
  );
}
