"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateToken, hashToken, tokenHint } from "@/lib/tokens";
import { SAVEABLE_TYPES } from "@/lib/capture";

/** Creates a private token. Returned ONCE so you can copy it; only its fingerprint is stored. */
export async function createTokenAction(
  name: string,
  scope: "capture" | "mcp",
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const parsed = z.object({ name: z.string().trim().min(1, "Give it a name").max(60), scope: z.enum(["capture", "mcp"]) }).safeParse({ name, scope });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const token = generateToken(parsed.data.scope);
  const supabase = await createClient();
  const { error } = await supabase.from("api_tokens").insert({
    name: parsed.data.name,
    scope: parsed.data.scope,
    token_hash: await hashToken(token),
    token_hint: tokenHint(token),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, token };
}

export async function revokeTokenAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Which capture types may skip the Inbox when Claude is confident (default: none). */
export async function setAutoSaveAction(types: string[]): Promise<{ ok: boolean; error?: string }> {
  const allowed = types.filter((t) => (SAVEABLE_TYPES as string[]).includes(t));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("profiles").update({ auto_save_types: allowed }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ── Notifications ──────────────────────────────────────────────────────────

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves this phone's push subscription (after you tap "Turn on reminders"). */
export async function savePushSubscriptionAction(subscription: unknown, deviceLabel: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "That subscription looks wrong" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  // Replace any old copy of this device's subscription.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device_label: deviceLabel.slice(0, 60) || null,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  refresh();
  return { ok: true };
}

/** Sends a test notification to every device you've turned reminders on for. */
export async function sendTestPushAction(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const supabase = await createClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subs?.length) return { ok: false, sent: 0, error: "Turn on reminders on this phone first" };
  const { sendPush } = await import("@/lib/push");
  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: "It works ✓", body: "Your dashboard can reach you here.", url: "/today", tag: "test" });
    if (r === "sent") sent++;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("id", s.id);
  }
  return sent ? { ok: true, sent } : { ok: false, sent, error: "Couldn't reach your phone. Try turning reminders off and on." };
}

/** Morning summary and evening preview times. */
export async function setReminderTimesAction(morning: string, evening: string): Promise<{ ok: boolean; error?: string }> {
  const t = z.string().regex(/^\d{2}:\d{2}$/);
  if (!t.safeParse(morning).success || !t.safeParse(evening).success) return { ok: false, error: "Use times like 07:00" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("profiles").update({ notify_morning: morning, notify_evening: evening }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
