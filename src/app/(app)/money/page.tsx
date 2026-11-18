import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";
import { formatLocalDate } from "@/lib/format";
import { dollars, lastMonths, monthKey, monthTotals, shiftMonthKey, type Tx } from "@/lib/money/summary";
import { Card, cx, PageHeader } from "@/components/ui";
import { CashAppImport, QuickMoney, SpendingBreakdown, TransactionRow } from "@/components/money-parts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (key: string, long = false) => {
  const [y, m] = key.split("-").map(Number);
  const short = MONTHS[m - 1];
  return long ? `${short} ${y}` : short;
};

/** Money: what came in, what went out, where it went. Cash App statements import here. */
export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  const params = await searchParams;
  const supabase = await createClient();
  const settings = await loadSettings(supabase);
  const thisMonth = monthKey(toLocalDate(new Date(), settings.timeZone));
  const month = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : thisMonth;

  const since = `${shiftMonthKey(month, -5)}-01`;
  const { data } = await supabase
    .from("money_transactions")
    .select("id, occurred_on, amount_cents, description, counterparty, category, source")
    .is("deleted_at", null)
    .gte("occurred_on", since)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = data ?? [];
  const txs: Tx[] = rows.map((r) => ({ occurredOn: r.occurred_on, amountCents: Number(r.amount_cents), category: r.category }));
  const totals = monthTotals(txs, month);
  const chart = lastMonths(txs, month, 6);
  const chartMax = Math.max(1, ...chart.flatMap((c) => [c.inCents, c.outCents]));
  const monthRows = rows.filter((r) => monthKey(r.occurred_on) === month);
  const byDay = new Map<string, typeof monthRows>();
  for (const r of monthRows) byDay.set(r.occurred_on, [...(byDay.get(r.occurred_on) ?? []), r]);
  const empty = rows.length === 0;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Money" subtitle="Finance">
        <div className="flex items-center gap-1">
          <Link href="/jobs" className="mr-1 rounded-xl border border-electric/40 bg-electric/10 px-3 py-1.5 text-sm font-semibold text-electric">
            🧽 Jobs
          </Link>
          <Link href={`/money?month=${shiftMonthKey(month, -1)}`} aria-label="Previous month" className="rounded-lg px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-ink">
            ‹
          </Link>
          <span className="min-w-16 text-center text-sm font-semibold">{monthName(month, true)}</span>
          {month < thisMonth && (
            <Link href={`/money?month=${shiftMonthKey(month, 1)}`} aria-label="Next month" className="rounded-lg px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-ink">
              ›
            </Link>
          )}
        </div>
      </PageHeader>

      {/* Hero */}
      <section className="hero hero-money glow-money rounded-3xl border border-ok/40 bg-surface/70 p-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-ok uppercase">{month === thisMonth ? "This month" : monthName(month, true)} · net</p>
        <p className={cx("mt-1 font-display text-5xl font-semibold tabular-nums", totals.netCents >= 0 ? "text-ok" : "text-danger")} style={{ textShadow: "0 0 24px currentColor" }}>
          {dollars(totals.netCents, true)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-ok/30 bg-bg/40 px-3 py-2.5">
            <p className="text-[11px] tracking-wider text-muted uppercase">↙ In</p>
            <p className="font-display text-xl font-semibold text-ok tabular-nums">{dollars(totals.inCents)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-bg/40 px-3 py-2.5">
            <p className="text-[11px] tracking-wider text-muted uppercase">↗ Out</p>
            <p className="font-display text-xl font-semibold tabular-nums">{dollars(totals.outCents)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <QuickMoney />
        </div>
      </section>

      {empty ? (
        <CashAppImport />
      ) : (
        <>
          {/* Last 6 months */}
          <Card title="Last 6 months">
            <div className="flex h-36 items-end gap-2">
              {chart.map((c, i) => (
                <Link key={c.key} href={`/money?month=${c.key}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="flex h-full w-full items-end justify-center gap-1">
                    <span
                      className="bar-grow w-1/2 max-w-4 rounded-t-md bg-ok"
                      style={{ height: `${(c.inCents / chartMax) * 100}%`, animationDelay: `${i * 60}ms`, boxShadow: "0 0 10px rgb(61 220 151 / 0.6)" }}
                    />
                    <span
                      className="bar-grow w-1/2 max-w-4 rounded-t-md bg-[#fb7185]"
                      style={{ height: `${(c.outCents / chartMax) * 100}%`, animationDelay: `${i * 60 + 30}ms`, boxShadow: "0 0 10px rgb(251 113 133 / 0.5)" }}
                    />
                  </div>
                  <span className={cx("text-[11px]", c.key === month ? "font-bold text-ok" : "text-muted")}>{monthName(c.key)}</span>
                </Link>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-xs text-muted">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ok" /> In
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#fb7185]" /> Out
              </span>
            </p>
          </Card>

          <Card title="Where it went">
            <SpendingBreakdown categories={totals.categories} />
          </Card>

          <Card title={`Transactions · ${monthRows.length}`}>
            {monthRows.length === 0 ? (
              <p className="text-sm text-muted">Nothing in {monthName(month, true)}.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {[...byDay.entries()].map(([day, list]) => (
                  <div key={day}>
                    <p className="mb-1.5 text-xs font-semibold tracking-wider text-faint uppercase">{formatLocalDate(day)}</p>
                    <ul className="rows flex flex-col gap-1.5">
                      {list.map((r) => (
                        <TransactionRow
                          key={r.id}
                          tx={{ id: r.id, description: r.description, counterparty: r.counterparty, amountCents: Number(r.amount_cents), category: r.category, source: r.source }}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <CashAppImport compact />
        </>
      )}
    </div>
  );
}
