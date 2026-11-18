import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { addDays, compareLocalDates, toLocalDate } from "@/lib/time";
import { formatLocalDate, formatTimeOfDay } from "@/lib/format";
import { jobTotals, washState } from "@/lib/jobs";
import { dollars } from "@/lib/money/summary";
import { Card, PageHeader } from "@/components/ui";
import { CustomerItem, JobItem, NewCustomer, type CustomerCard, type JobCard } from "@/components/jobs-parts";

/** Jobs: Ethan's window-washing business. Customers, bookings, and getting paid (→ Money). */
export default async function JobsPage() {
  const supabase = await createClient();
  const settings = await loadSettings(supabase);
  const today = toLocalDate(new Date(), settings.timeZone);
  const since = addDays(today, -180);

  const [{ data: customers }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("id, name, phone, address, repeat_weeks, default_price_cents").is("deleted_at", null).order("name"),
    supabase
      .from("jobs")
      .select("id, customer_id, scheduled_on, scheduled_time, price_cents, status, notes")
      .is("deleted_at", null)
      .gte("scheduled_on", since)
      .order("scheduled_on"),
  ]);
  const custById = new Map((customers ?? []).map((c) => [c.id, c]));
  const status = (s: string) => (s === "done" || s === "paid" ? s : "scheduled") as JobCard["status"];
  const dayText = (d: string) => (d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : formatLocalDate(d));

  const cards: JobCard[] = (jobs ?? []).map((j) => {
    const c = custById.get(j.customer_id);
    return {
      id: j.id,
      customer: c?.name ?? "Customer",
      address: c?.address ?? null,
      phone: c?.phone ?? null,
      on: j.scheduled_on,
      onText: dayText(j.scheduled_on),
      time: j.scheduled_time ? formatTimeOfDay(j.scheduled_time) : null,
      priceCents: j.price_cents,
      status: status(j.status),
      notes: j.notes,
      isToday: j.scheduled_on === today,
      isPast: compareLocalDates(j.scheduled_on, today) < 0,
    };
  });
  const upcoming = cards.filter((j) => j.status === "scheduled");
  const unpaid = cards.filter((j) => j.status === "done");
  const paid = cards.filter((j) => j.status === "paid").reverse().slice(0, 10);
  const totals = jobTotals(
    (jobs ?? []).map((j) => ({ status: status(j.status), priceCents: j.price_cents, date: j.scheduled_on })),
    today.slice(0, 7),
  );

  // Customers: who's due for a wash first.
  const order = { due: 0, new: 1, scheduled: 2, ok: 3, "one-time": 4 } as const;
  const customerCards: CustomerCard[] = (customers ?? [])
    .map((c) => {
      const theirs = (jobs ?? []).filter((j) => j.customer_id === c.id);
      const last = theirs.filter((j) => j.status !== "scheduled").map((j) => j.scheduled_on).sort().pop() ?? null;
      const next = theirs.filter((j) => j.status === "scheduled" && j.scheduled_on >= today).map((j) => j.scheduled_on).sort()[0] ?? null;
      const s = washState({ repeatWeeks: c.repeat_weeks }, last, next, today);
      const state =
        s.kind === "due"
          ? `Due for a wash${s.daysOver ? ` · ${s.daysOver} day${s.daysOver === 1 ? "" : "s"} over` : " today"}`
          : s.kind === "ok"
            ? `Next wash ~${formatLocalDate(s.next)} (in ${s.inDays} days)`
            : s.kind === "scheduled"
              ? `Booked ${dayText(s.on)}`
              : s.kind === "new"
                ? "New: book the first wash"
                : "One-time customer";
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        repeatWeeks: c.repeat_weeks,
        defaultPriceCents: c.default_price_cents,
        state,
        tone: s.kind,
        jobs: theirs.length,
      };
    })
    .sort((a, b) => order[a.tone] - order[b.tone]);
  const dueCount = customerCards.filter((c) => c.tone === "due").length;
  const nextJob = upcoming.find((j) => !j.isPast);

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Jobs" subtitle="Window washing">
        <Link href="/money" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:text-ink">
          💰 Money
        </Link>
      </PageHeader>

      {/* Hero */}
      <section className="hero hero-glass glow-glass rounded-3xl border border-electric/40 bg-surface/70 p-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-electric uppercase">🧽 This month</p>
        <p className="mt-1 font-display text-5xl font-semibold text-ok tabular-nums" style={{ textShadow: "0 0 24px currentColor" }}>
          {dollars(totals.paidCents)}
        </p>
        <p className="text-sm text-muted">
          earned from {totals.jobsDone} job{totals.jobsDone === 1 ? "" : "s"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Owed", value: dollars(totals.owedCents), tone: totals.owedCents ? "text-warn" : "text-muted" },
            { label: "Booked", value: dollars(totals.bookedCents), tone: "text-electric" },
            { label: "Due", value: String(dueCount), tone: dueCount ? "text-warn" : "text-muted" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-bg/40 px-2 py-2">
              <p className={`font-display text-lg font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
              <p className="text-[10px] tracking-wider text-muted uppercase">{s.label}</p>
            </div>
          ))}
        </div>
        {nextJob && (
          <p className="mt-3 rounded-2xl border border-electric/30 bg-electric/10 px-3 py-2 text-sm">
            Next: <b>{nextJob.customer}</b> · {nextJob.onText}
            {nextJob.time ? ` · ${nextJob.time}` : ""} · {dollars(nextJob.priceCents)}
          </p>
        )}
      </section>

      {unpaid.length > 0 && (
        <Card title={`Waiting on payment · ${unpaid.length}`} className="border-warn/40">
          <ul className="rows flex flex-col gap-2">
            {unpaid.map((j) => (
              <JobItem key={j.id} job={j} />
            ))}
          </ul>
        </Card>
      )}

      <Card title={`Up next · ${upcoming.length}`}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No washes booked. Tap “Book a wash” on a customer below.</p>
        ) : (
          <ul className="rows flex flex-col gap-2">
            {upcoming.map((j) => (
              <JobItem key={j.id} job={j} />
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Customers · ${customerCards.length}`}>
        <div className="flex flex-col gap-2">
          <ul className="rows flex flex-col gap-2">
            {customerCards.map((c) => (
              <CustomerItem key={c.id} c={c} today={today} />
            ))}
          </ul>
          <NewCustomer />
        </div>
      </Card>

      {paid.length > 0 && (
        <details className="group rounded-3xl border border-line bg-surface/60 p-4">
          <summary className="cursor-pointer list-none text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Paid recently · {paid.length} <span className="text-faint group-open:hidden">(show)</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {paid.map((j) => (
              <JobItem key={j.id} job={j} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
