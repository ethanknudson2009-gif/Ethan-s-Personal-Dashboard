"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function addCustomerAction(input: { name: string; phone?: string; address?: string; repeatWeeks?: number | null; priceDollars?: number | null; notes?: string }): Promise<Result> {
  const p = z
    .object({
      name: z.string().trim().min(1, "Customer name?").max(80),
      phone: z.string().trim().max(30).optional(),
      address: z.string().trim().max(200).optional(),
      repeatWeeks: z.number().int().min(1).max(52).nullable().optional(),
      priceDollars: z.number().min(0).max(100000).nullable().optional(),
      notes: z.string().max(1000).optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const c = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: c.name,
    phone: c.phone || null,
    address: c.address || null,
    repeat_weeks: c.repeatWeeks ?? null,
    default_price_cents: c.priceDollars != null ? Math.round(c.priceDollars * 100) : null,
    notes: c.notes || null,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteCustomerAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function addJobAction(input: { customerId: string; on: string; time?: string | null; priceDollars: number; notes?: string }): Promise<Result> {
  const p = z
    .object({
      customerId: z.string().uuid(),
      on: date,
      time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      priceDollars: z.number().min(0).max(100000),
      notes: z.string().max(1000).optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    customer_id: p.data.customerId,
    scheduled_on: p.data.on,
    scheduled_time: p.data.time || null,
    price_cents: Math.round(p.data.priceDollars * 100),
    notes: p.data.notes || null,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Moves a job along: scheduled → done → paid. "Paid" adds the income to
 * Money (category Window washing); going back from paid removes it again.
 */
export async function setJobStatusAction(id: string, status: "scheduled" | "done" | "paid"): Promise<Result> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, status, price_cents, scheduled_on, money_id, customers(name)")
    .eq("id", id)
    .single();
  if (error || !job) return { ok: false, error: "Couldn't find that job" };

  let moneyId = job.money_id;
  if (status === "paid" && !moneyId && job.price_cents > 0) {
    const { data: tx, error: e1 } = await supabase
      .from("money_transactions")
      .insert({
        occurred_on: job.scheduled_on,
        amount_cents: job.price_cents,
        description: `Window job · ${job.customers?.name ?? "customer"}`,
        counterparty: job.customers?.name ?? null,
        category: "Window washing",
        source: "manual",
      })
      .select("id")
      .single();
    if (e1 || !tx) return { ok: false, error: e1?.message ?? "Couldn't add the income" };
    moneyId = tx.id;
  }
  if (status !== "paid" && moneyId) {
    await supabase.from("money_transactions").delete().eq("id", moneyId);
    moneyId = null;
  }
  const { error: e2 } = await supabase.from("jobs").update({ status, money_id: moneyId }).eq("id", id);
  if (e2) return { ok: false, error: e2.message };
  refresh();
  return { ok: true };
}

export async function deleteJobAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("money_id").eq("id", id).single();
  if (job?.money_id) await supabase.from("money_transactions").delete().eq("id", job.money_id);
  const { error } = await supabase.from("jobs").update({ deleted_at: new Date().toISOString(), money_id: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
