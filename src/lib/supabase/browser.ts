"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Supabase client for code running in the browser (client components). */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
