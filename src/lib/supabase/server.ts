import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase client for server components, server actions and route handlers.
 * It reads the login session from cookies, so every query runs as the
 * logged-in user and Row Level Security applies.
 */
export async function createClient() {
  // Read cookies first: this tells Next.js the page is personal and must be
  // rendered per request, not pre-built once at deploy time.
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
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
