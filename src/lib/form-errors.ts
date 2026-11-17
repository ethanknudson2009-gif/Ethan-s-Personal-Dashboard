import { redirect } from "next/navigation";

/**
 * Sends the user back to `path` with a readable error message in the
 * address (?error=…), which the page shows as a banner. We do this instead
 * of throwing, because Next.js hides thrown error messages on the live site.
 */
export function failTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
