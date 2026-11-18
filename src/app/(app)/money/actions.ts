"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";
import { CATEGORIES, categorize } from "@/lib/money/categories";

type Result = { ok: true } | { ok: false; error: string };

const imported = z.object({
  externalId: z.string().min(1).max(200),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int(),
  description: z.string().max(200),
  counterparty: z.string().max(200).nullable(),
  category: z.string().max(40),
});

/** Saves transactions read from a Cash App statement. Ones already imported are skipped. */
export async function importCashAppAction(rows: unknown): Promise<{ ok: true; added: number; duplicates: number } | { ok: false; error: string }> {
  const parsed = z.array(imported).max(5000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "That statement had something unexpected in it." };
  const supabase = await createClient();
  let added = 0;
  for (let i = 0; i < parsed.data.length; i += 500) {
    const chunk = parsed.data.slice(i, i + 500).map((t) => ({
      occurred_on: t.occurredOn,
      amount_cents: t.amountCents,
      description: t.description,
      counterparty: t.counterparty,
      category: t.category,
      source: "cashapp" as const,
      external_id: t.externalId,
    }));
    const { data, error } = await supabase
      .from("money_transactions")
      .upsert(chunk, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, error: error.message };
    added += data?.length ?? 0;
  }
  refresh();
  return { ok: true, added, duplicates: parsed.data.length - added };
}

/** Adds one transaction by hand (or from "spent $12 gas"). Money out is negative. */
export async function addMoneyAction(input: { amountCents: number; description: string; category?: string; occurredOn?: string }): Promise<Result> {
  const p = z
    .object({
      amountCents: z.number().int().refine((n) => n !== 0, "Enter an amount"),
      description: z.string().trim().min(1, "What was it for?").max(200),
      category: z.string().max(40).optional(),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const { error } = await supabase.from("money_transactions").insert({
    amount_cents: p.data.amountCents,
    description: p.data.description,
    category: p.data.category ?? categorize(p.data.description, p.data.amountCents),
    occurred_on: p.data.occurredOn ?? toLocalDate(new Date(), timeZone),
    source: "manual",
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setCategoryAction(id: string, category: string): Promise<Result> {
  if (!CATEGORIES.some((c) => c.name === category)) return { ok: false, error: "Unknown category" };
  const supabase = await createClient();
  const { error } = await supabase.from("money_transactions").update({ category }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteMoneyAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("money_transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
