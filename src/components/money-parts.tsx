"use client";

/** Interactive pieces of the Money page. */
import { useRef, useState, useTransition } from "react";
import { addMoneyAction, deleteMoneyAction, importCashAppAction, setCategoryAction } from "@/app/(app)/money/actions";
import { readCashAppCsv } from "@/lib/money/cashapp";
import { CATEGORIES, categoryInfo } from "@/lib/money/categories";
import { dollars } from "@/lib/money/summary";
import { Button, Chip, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

// ── Cash App import ─────────────────────────────────────────────────────────
export function CashAppImport({ compact = false }: { compact?: boolean }) {
  const sheet = useTaskSheet();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [showHow, setShowHow] = useState(!compact);

  function onFile(file: File) {
    startTransition(async () => {
      const text = await file.text();
      const r = readCashAppCsv(text);
      if (r.error) return sheet.toast(r.error);
      const res = await importCashAppAction(r.transactions);
      if (!res.ok) return sheet.toast(`Import failed: ${res.error}`);
      sheet.toast(
        res.added === 0
          ? "Already up to date: nothing new in that statement"
          : `Imported ${res.added} transaction${res.added === 1 ? "" : "s"} ✓${res.duplicates ? ` (${res.duplicates} already there)` : ""}`,
      );
      if (input.current) input.current.value = "";
    });
  }

  return (
    <section className="rounded-3xl border border-ok/30 bg-ok/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00d64f] font-display text-lg font-bold text-black shadow-[0_0_18px_-4px_#00d64f]">$</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Cash App</p>
          <p className="text-xs text-muted">Import your statement. Duplicates are skipped automatically.</p>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="glow-money rounded-xl bg-ok px-4 py-2 text-sm font-semibold text-[#032016] transition active:scale-95 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import CSV"}
        </button>
      </div>
      <button type="button" onClick={() => setShowHow(!showHow)} className="mt-3 text-xs font-medium text-ok">
        {showHow ? "Hide" : "How do I get the file?"}
      </button>
      {showHow && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>
            On a computer, sign in at <b className="text-ink">cash.app</b> → <b className="text-ink">Statements</b> (or Activity) → <b className="text-ink">Export CSV</b>.
          </li>
          <li>In the Cash App on your phone, look under your profile → <b className="text-ink">Documents & Statements</b> for an export option.</li>
          <li>Tap <b className="text-ink">Import CSV</b> here and pick the file. Import a new one any time; nothing gets doubled.</li>
        </ol>
      )}
    </section>
  );
}

// ── Quick add ───────────────────────────────────────────────────────────────
export function QuickMoney() {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 rounded-2xl border border-line bg-raised/80 px-4 py-3 text-sm font-semibold transition hover:border-ok/50 active:scale-[0.97]"
      >
        + Add by hand
      </button>
    );
  }
  return (
    <form
      className="fade-in flex w-full flex-col gap-3 rounded-2xl border border-ok/30 bg-surface/90 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
        startTransition(async () => {
          const r = await addMoneyAction({ amountCents: direction === "out" ? -cents : cents, description: what, category });
          if (!r.ok) return sheet.toast(r.error);
          sheet.toast(`${direction === "out" ? "Spent" : "Got"} ${dollars(cents)} · ${what} ✓`);
          setAmount("");
          setWhat("");
          setCategory(undefined);
          setOpen(false);
        });
      }}
    >
      <div className="flex gap-2">
        <Chip active={direction === "out"} onClick={() => setDirection("out")}>
          ↗ Spent
        </Chip>
        <Chip active={direction === "in"} onClick={() => setDirection("in")}>
          ↙ Got paid
        </Chip>
      </div>
      <div className="flex gap-2">
        <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$0" className={cx(inputClass, "w-24 text-lg font-semibold")} />
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder={direction === "out" ? "Gas, lunch…" : "Paycheck, refund…"} className={cx(inputClass, "min-w-0 flex-1")} />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {CATEGORIES.filter((c) => c.name !== "Transfers").map((c) => (
          <Chip key={c.name} active={category === c.name} onClick={() => setCategory(category === c.name ? undefined : c.name)}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !amount || !what} className="glow-money flex-1 bg-ok text-[#032016]">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Spending by category (tap to hide one) ─────────────────────────────────
export function SpendingBreakdown({ categories }: { categories: { name: string; cents: number }[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = categories.filter((c) => !hidden.has(c.name));
  const total = shown.reduce((s, c) => s + c.cents, 0);
  const max = Math.max(1, ...shown.map((c) => c.cents));
  if (!categories.length) return <p className="text-sm text-muted">No spending this month yet.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {categories.map((c) => {
        const info = categoryInfo(c.name);
        const off = hidden.has(c.name);
        return (
          <button
            key={c.name}
            type="button"
            onClick={() => {
              const next = new Set(hidden);
              if (off) next.delete(c.name);
              else next.add(c.name);
              setHidden(next);
            }}
            className={cx("flex flex-col gap-1 text-left transition", off && "opacity-35")}
            title={off ? "Tap to show" : "Tap to hide from the total"}
          >
            <span className="flex items-center gap-2 text-sm">
              <span>{info.emoji}</span>
              <span className={cx("flex-1 font-medium", off && "line-through")}>{c.name}</span>
              <span className="tabular-nums">{dollars(c.cents)}</span>
              <span className="w-10 text-right text-xs text-faint tabular-nums">{off || !total ? "" : `${Math.round((c.cents / total) * 100)}%`}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full transition-all duration-700"
                style={{ width: off ? "0%" : `${(c.cents / max) * 100}%`, backgroundColor: info.color, boxShadow: `0 0 10px ${info.color}` }}
              />
            </span>
          </button>
        );
      })}
      {hidden.size > 0 && <p className="text-xs text-faint">Total without hidden: {dollars(total)}</p>}
    </div>
  );
}

// ── One transaction ─────────────────────────────────────────────────────────
export function TransactionRow({
  tx,
}: {
  tx: { id: string; description: string; counterparty: string | null; amountCents: number; category: string; source: string };
}) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);
  const info = categoryInfo(tx.category);
  if (gone) return null;
  const incoming = tx.amountCents > 0;
  return (
    <li className={cx("flex items-center gap-3 rounded-2xl border border-line bg-raised/70 px-3 py-2.5", pending && "opacity-50")}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
        style={{ backgroundColor: `${info.color}22`, boxShadow: `inset 0 0 0 1px ${info.color}55` }}
      >
        {info.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.counterparty || tx.description}</p>
        <div className="flex items-center gap-1.5">
          <select
            value={tx.category}
            onChange={(e) =>
              startTransition(async () => {
                const r = await setCategoryAction(tx.id, e.target.value);
                if (!r.ok) sheet.toast(r.error);
              })
            }
            aria-label="Category"
            className="max-w-[9rem] truncate rounded-md bg-transparent py-0.5 text-xs text-muted outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          {tx.source === "cashapp" && <span className="rounded bg-[#00d64f]/15 px-1 text-[9px] font-bold text-[#00d64f]">CASH APP</span>}
        </div>
      </div>
      <span className={cx("shrink-0 font-display font-semibold tabular-nums", incoming ? "text-ok" : "text-ink")}>{dollars(tx.amountCents, true)}</span>
      <button
        type="button"
        aria-label="Delete"
        onClick={() =>
          startTransition(async () => {
            const r = await deleteMoneyAction(tx.id);
            if (r.ok) setGone(true);
            else sheet.toast(r.error);
          })
        }
        className="shrink-0 text-xs text-faint hover:text-danger"
      >
        ✕
      </button>
    </li>
  );
}
