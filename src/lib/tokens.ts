/**
 * Private tokens for the iPhone Shortcut and the Claude connector.
 * The token is shown once; we store only its SHA-256 fingerprint.
 * Works in Node and the browser (Web Crypto).
 */

const PREFIX = { capture: "dshc_", mcp: "dshm_" } as const;
export type TokenScope = keyof typeof PREFIX;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A new random token, e.g. "dshc_3q2…" (32 random bytes ≈ 43 characters). */
export function generateToken(scope: TokenScope): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return PREFIX[scope] + toBase64Url(bytes);
}

/** The SHA-256 fingerprint we store instead of the token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Last 4 characters, shown in Settings to tell tokens apart. */
export function tokenHint(token: string): string {
  return token.slice(-4);
}

/** Reads "Bearer <token>" from an Authorization header; null if missing or malformed. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(dsh[cm]_[A-Za-z0-9_-]{20,100})\s*$/.exec(header ?? "");
  return m ? m[1] : null;
}

export function scopeOf(token: string): TokenScope | null {
  if (token.startsWith(PREFIX.capture)) return "capture";
  if (token.startsWith(PREFIX.mcp)) return "mcp";
  return null;
}
