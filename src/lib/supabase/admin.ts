import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { CaptureStore } from "@/lib/capture/handle";
import { DEFAULT_TIME_ZONE } from "@/lib/time";

/**
 * Admin database access, for routes called by the iPhone Shortcut or Claude
 * (no logged-in browser). It uses the SECRET key, which skips Row Level
 * Security, so (docs/07 §5):
 *  - it lives only here, and "server-only" stops it ever reaching a browser;
 *  - every query below is filtered by the userId found from a valid token.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SECRET_KEY (server setting).");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Admin = ReturnType<typeof createAdminClient>;

/** The database side of /api/capture. Every call is scoped to one user. */
export function captureStore(db: Admin): CaptureStore {
  return {
    async findTokenUser(tokenHash, scope) {
      const { data } = await db
        .from("api_tokens")
        .select("id, user_id")
        .eq("token_hash", tokenHash)
        .eq("scope", scope)
        .is("revoked_at", null)
        .maybeSingle();
      return data ? { userId: data.user_id, tokenId: data.id } : null;
    },

    async touchToken(tokenId) {
      await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenId);
    },

    async loadContext(userId) {
      const [{ data: profile }, { data: classes }] = await Promise.all([
        db.from("profiles").select("timezone, auto_save_types").eq("id", userId).maybeSingle(),
        db.from("classes").select("id, name, short_names").eq("user_id", userId).is("deleted_at", null).eq("archived", false),
      ]);
      return {
        timeZone: profile?.timezone || DEFAULT_TIME_ZONE,
        autoSaveTypes: profile?.auto_save_types ?? [],
        classes: (classes ?? []).map((c) => ({ id: c.id, name: c.name, shortNames: c.short_names })),
      };
    },

    async findByClientId(userId, clientId) {
      const { data } = await db
        .from("inbox_items")
        .select("id, status")
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .maybeSingle();
      return data;
    },

    async insertTask(userId, row) {
      const { data, error } = await db.from("tasks").insert({ ...row, user_id: userId }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "insert failed");
      return data.id;
    },

    async insertInbox(userId, item) {
      const { data, error } = await db
        .from("inbox_items")
        .insert({ ...item, user_id: userId })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "insert failed");
      return data.id;
    },
  };
}
