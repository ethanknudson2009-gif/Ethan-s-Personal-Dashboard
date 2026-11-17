/**
 * Small helper for the parser: remembers which parts of the sentence have
 * already been "used" (e.g. "$12" was the amount, "Fri 11:59pm" was the date),
 * so two rules never grab the same words, and so the leftover words can
 * become the title.
 */
export type Span = { start: number; end: number };

export class SpanTracker {
  private spans: Span[] = [];

  /** True if [start, end) overlaps anything already claimed. */
  isTaken(start: number, end: number): boolean {
    return this.spans.some((s) => start < s.end && end > s.start);
  }

  claim(start: number, end: number): void {
    this.spans.push({ start, end });
  }

  /**
   * Finds every match of `regex` (must have the "g" flag) in `text` that
   * doesn't overlap a claimed span. Does NOT claim them: call claim() for the
   * ones you use.
   */
  free(regex: RegExp, text: string): RegExpExecArray[] {
    const found: RegExpExecArray[] = [];
    regex.lastIndex = 0;
    for (let m = regex.exec(text); m; m = regex.exec(text)) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      if (!this.isTaken(m.index, m.index + m[0].length)) found.push(m);
    }
    return found;
  }

  /** `text` with every claimed span replaced by a space. */
  leftover(text: string): string {
    const chars = text.split(""); // UTF-16 units, matching regex indexes
    for (const s of this.spans) for (let i = s.start; i < s.end; i++) chars[i] = " ";
    return chars.join("");
  }
}
