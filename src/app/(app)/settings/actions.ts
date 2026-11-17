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
