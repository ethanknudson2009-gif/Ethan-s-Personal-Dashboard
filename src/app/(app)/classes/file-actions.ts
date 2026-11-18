"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Removes an uploaded file: the stored file and its record (you confirm first). */
export async function removeFileAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: file, error } = await supabase.from("files").select("storage_path").eq("id", id).single();
  if (error || !file) return { ok: false, error: "Couldn't find that file" };
  const { error: e1 } = await supabase.storage.from("user-files").remove([file.storage_path]);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase.from("files").delete().eq("id", id);
  if (e2) return { ok: false, error: e2.message };
  refresh();
  return { ok: true };
}
