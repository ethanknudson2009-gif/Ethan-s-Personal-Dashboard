import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Supabase client for server components, server actions and route handlers.
 * It reads the login session from cookies, so every query runs as the
 * logged-in user and Row Level Security applies.
 */
export async function createClient() {
  // Wait for a real request first. Personal data must never be pre-rendered,
  // and the Supabase library reads the clock (Date.now), which Next.js only
  // allows at request time. (Reading cookies alone isn't enough: partial
  // prefetching can pre-render with cookies available.)
  await connection();
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session cookie on every request instead.
        }
      },
    },
  });
}
