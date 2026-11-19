/**
 * Stitching speech pieces together.
 *
 * Long talks arrive in pieces: the recognizer sends one piece per pause, and
 * it restarts every so often (the phone stops listening after a while, so we
 * start it again). Safari on iPhone sometimes re-sends words it already sent.
 * These helpers join the pieces without repeating anything, and mark a pause
 * as the end of a sentence (which helps tell items and details apart).
 */

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Join two pieces, dropping any words the second one repeats from the first. */
export function joinHeard(a: string, b: string, pause = false): string {
  const A = a.trim();
  const B = b.trim();
  if (!A) return B;
  if (!B) return A;
  const aw = words(A);
  const bw = words(B);
  const na = aw.map(norm).join(" ");
  const nb = bw.map(norm).join(" ");
  // The new piece repeats everything so far and adds more (Safari does this).
  if (nb.startsWith(na)) return B;
  // The new piece was already heard.
  if (na.endsWith(nb) || (bw.length >= 4 && na.includes(nb))) return A;
  // The new piece starts with the last few words of the old one.
  for (let k = Math.min(aw.length, bw.length); k >= 2; k--) {
    if (aw.slice(-k).map(norm).join(" ") === bw.slice(0, k).map(norm).join(" ")) return [...aw, ...bw.slice(k)].join(" ");
  }
  // A pause between pieces ends a sentence, unless it already did.
  const glue = pause && !/[.!?,;:]$/.test(A) ? ". " : " ";
  return `${A}${glue}${B}`;
}

/** Join many pieces in order (a pause between each one). */
export function joinPieces(pieces: string[]): string {
  return pieces.reduce((acc, p) => joinHeard(acc, p, true), "");
}
