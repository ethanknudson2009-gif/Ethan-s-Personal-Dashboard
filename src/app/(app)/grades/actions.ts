"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function addCategoryAction(input: { classId: string; name: string; weight: number }): Promise<Result> {
  const p = z
    .object({ classId: z.string().uuid(), name: z.string().trim().min(1, "Name it, e.g. Tests").max(40), weight: z.number().min(0).max(100) })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("grade_categories").insert({ class_id: p.data.classId, name: p.data.name, weight: p.data.weight });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("grade_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function addGradeAction(input: {
  classId: string;
  categoryId: string | null;
  title: string;
  earned: number;
  possible: number;
  whatIf: boolean;
}): Promise<Result> {
  const p = z
    .object({
      classId: z.string().uuid(),
      categoryId: z.string().uuid().nullable(),
      title: z.string().trim().min(1, "Name it, e.g. Chapter 3 quiz").max(120),
      earned: z.number().min(0).max(100000),
      possible: z.number().gt(0, "Points possible must be more than 0").max(100000),
      whatIf: z.boolean(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const g = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("grades").insert({
    class_id: g.classId,
    category_id: g.categoryId,
    title: g.title,
    points_earned: g.earned,
    points_possible: g.possible,
    is_what_if: g.whatIf,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteGradeAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
