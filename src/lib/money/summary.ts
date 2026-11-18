/**
 * Money math for the Money page (pure, tested): month totals, spending by
 * category, and the last few months for the chart.
 */
export type Tx = { occurredOn: string; amountCents: number; category: string };

export function monthKey(date: string): string {
  return date.slice(0, 7); // "2026-11"
}

export function shiftMonthKey(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + by;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthTotals(txs: Tx[], key: string) {
  let inCents = 0;
  let outCents = 0;
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    if (monthKey(t.occurredOn) !== key || t.category === "Transfers") continue; // moving your own money isn't spending
    if (t.amountCents > 0) inCents += t.amountCents;
    else {
      outCents += -t.amountCents;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) - t.amountCents);
    }
  }
  const categories = [...byCategory.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);
  return { inCents, outCents, netCents: inCents - outCents, categories };
}

/** Totals for `count` months ending with `key` (oldest first), for the chart. */
export function lastMonths(txs: Tx[], key: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const k = shiftMonthKey(key, i - count + 1);
    const t = monthTotals(txs, k);
    return { key: k, inCents: t.inCents, outCents: t.outCents };
  });
}

/** 1234 → "$12.34"; with sign → "+$12.34" / "−$12.34". */
export function dollars(cents: number, sign = false): string {
  const abs = Math.abs(cents) / 100;
  const text = `$${abs.toLocaleString("en-US", { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  if (!sign) return text;
  return cents > 0 ? `+${text}` : cents < 0 ? `−${text}` : text;
}
