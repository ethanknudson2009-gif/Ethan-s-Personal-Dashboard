import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Runs before page requests: keeps you signed in and sends logged-out visitors to /login. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip API routes (they use their own private tokens), Next.js internals, app icons,
  // the manifest and the service worker: iPhone fetches icons without being logged in.
  matcher: ["/((?!api/|_next/static|_next/image|icon|apple-icon|icons/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
