/**
 * Reads the public Supabase settings. These two values are safe to show in
 * the browser: Row Level Security in the database is what protects data.
 * Where to find them: docs/setup/01-supabase-and-vercel.md
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local and fill them in (see docs/setup/01-supabase-and-vercel.md).",
    );
  }
  return { url, key };
}
