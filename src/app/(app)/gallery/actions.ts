"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/themes";
import { LAYOUTS } from "@/lib/layouts";

type Result = { ok: true } | { ok: false; error: string };

/** Saves your color theme (applies on every device). */
export async function saveThemeAction(id: string): Promise<Result> {
  if (!THEMES.some((t) => t.id === id)) return { ok: false, error: "Unknown theme" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("profiles").update({ theme: id }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Likes or unlikes a layout idea. */
export async function toggleLayoutLikeAction(id: string): Promise<Result> {
  if (!LAYOUTS.some((l) => l.id === id)) return { ok: false, error: "Unknown layout" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await supabase.from("profiles").select("liked_layouts").eq("id", user.id).maybeSingle();
  const now = data?.liked_layouts ?? [];
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
  const { error } = await supabase.from("profiles").update({ liked_layouts: next }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
