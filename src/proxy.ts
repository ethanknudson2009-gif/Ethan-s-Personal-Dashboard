import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Runs before page requests: keeps you signed in and sends logged-out visitors to /login. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip API routes (they use their own private tokens), Next.js internals and static files.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
