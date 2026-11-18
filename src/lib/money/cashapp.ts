/**
 * Reads a Cash App statement export (CSV) into transactions.
 *
 * Cash App's export has columns like Transaction ID, Date, Transaction Type,
 * Amount, Fee, Net Amount, Status, Notes and Name of sender/receiver. We find
 * columns by name (not position) so small changes to the file still work,
 * and we skip anything that didn't go through (failed, canceled, refunded
 * before completing).
 */
import { parseCsv } from "./csv";
import { categorize } from "./categories";

export type ImportedTransaction = {
  externalId: string;
  occurredOn: string; // YYYY-MM-DD
  amountCents: number; // + in, − out
  description: string;
  counterparty: string | null;
  category: string;
};

export type ImportResult = { transactions: ImportedTransaction[]; skipped: number; error: string | null };

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

/** "-$1,234.50" / "$12" / "(12.00)" / "12.5" → cents, or null. */
export function moneyToCents(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const negative = /^-|^\(.*\)$|-\s*\$/.test(v);
  const digits = v.replace(/[^0-9.]/g, "");
  if (!digits || isNaN(Number(digits))) return null;
  const cents = Math.round(Number(digits) * 100);
  return negative ? -cents : cents;
}

/** "2026-11-15 14:23:01 MST" / "11/15/2026" / "Nov 15, 2026" → "2026-11-15". */
export function toIsoDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(v);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function readCashAppCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { transactions: [], skipped: 0, error: "That file has no transactions in it." };

  const header = rows[0].map(norm);
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    // Looser: a header that contains the word.
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iId = col("transactionid", "id");
  const iDate = col("date", "transactiondate");
  const iNet = col("netamount");
  const iAmount = col("amount", "total");
  const iType = col("transactiontype", "type");
  const iStatus = col("status");
  const iNotes = col("notes", "description", "memo");
  const iName = col("nameofsenderreceiver", "senderreceiver", "name", "counterparty");

  if (iDate < 0 || (iNet < 0 && iAmount < 0)) {
    return { transactions: [], skipped: 0, error: "This doesn't look like a Cash App statement (no Date or Amount column)." };
  }

  const transactions: ImportedTransaction[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const status = get(iStatus).toLowerCase();
    if (status && /(fail|cancel|declin|pending|waiting|expired)/.test(status)) {
      skipped++;
      continue;
    }
    const date = toIsoDate(get(iDate));
    const cents = moneyToCents(get(iNet) || get(iAmount));
    if (!date || cents === null || cents === 0) {
      skipped++;
      continue;
    }
    const type = get(iType);
    const notes = get(iNotes);
    const name = get(iName);
    const description = [notes, type].filter(Boolean).join(" · ") || (cents > 0 ? "Money in" : "Money out");
    // Without an id, make a stable one from the details so re-imports are still skipped.
    const externalId = get(iId) || `${date}|${cents}|${name}|${notes}`.slice(0, 200);
    transactions.push({
      externalId,
      occurredOn: date,
      amountCents: cents,
      description: description.slice(0, 200),
      counterparty: name || null,
      category: categorize(`${notes} ${name} ${type}`, cents),
    });
  }
  return { transactions, skipped, error: transactions.length ? null : "No completed transactions found in that file." };
}
