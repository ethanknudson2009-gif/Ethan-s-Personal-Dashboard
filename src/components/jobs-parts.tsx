"use client";

/** Interactive pieces of the Jobs page (window-washing side business). */
import { useState, useTransition } from "react";
import { addCustomerAction, addJobAction, deleteCustomerAction, deleteJobAction, setJobStatusAction } from "@/app/(app)/jobs/actions";
import { dollars } from "@/lib/money/summary";
import { Button, Chip, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const GLASS = "#5b8cff";

export type JobCard = {
  id: string;
  customer: string;
  address: string | null;
  phone: string | null;
  on: string;
  onText: string;
  time: string | null;
  priceCents: number;
  status: "scheduled" | "done" | "paid";
  notes: string | null;
  isToday: boolean;
  isPast: boolean;
};

const mapsLink = (address: string) => `https://maps.apple.com/?q=${encodeURIComponent(address)}`;

export function JobItem({ job }: { job: JobCard }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const move = (status: JobCard["status"], msg: string) =>
    startTransition(async () => {
      const r = await setJobStatusAction(job.id, status);
      sheet.toast(r.ok ? msg : `Couldn't update: ${r.error}`);
    });
  const late = job.status === "scheduled" && job.isPast;
  return (
    <li
      className={cx(
        "flex flex-col gap-2 rounded-2xl border bg-raised/70 p-3 transition",
        job.isToday && job.status === "scheduled" ? "border-electric/60" : late ? "border-warn/50" : "border-line",
        pending && "opacity-50",
      )}
      style={job.isToday && job.status === "scheduled" ? { boxShadow: `0 0 0 1px ${GLASS}88, 0 0 22px -6px ${GLASS}` } : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${GLASS}22`, boxShadow: `inset 0 0 0 1px ${GLASS}55` }}>
          🧽
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{job.customer}</p>
          <p className={cx("text-xs", job.isToday ? "font-semibold text-electric" : late ? "text-warn" : "text-muted")}>
            {job.onText}
            {job.time ? ` · ${job.time}` : ""}
            {late && " · not marked done"}
          </p>
          {job.address && (
            <a href={mapsLink(job.address)} target="_blank" rel="noreferrer" className="block truncate text-xs text-faint underline-offset-2 hover:underline">
              📍 {job.address}
            </a>
          )}
          {job.notes && <p className="mt-0.5 line-clamp-2 text-xs text-muted italic">{job.notes}</p>}
        </div>
        <span className={cx("shrink-0 font-display text-lg font-semibold tabular-nums", job.status === "paid" ? "text-ok" : "text-ink")}>{dollars(job.priceCents)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {job.status === "scheduled" && (
          <button
            type="button"
            onClick={() => move("done", "Marked done ✓")}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
            style={{ backgroundColor: GLASS, boxShadow: `0 0 14px -4px ${GLASS}` }}
          >
            ✓ Done
          </button>
        )}
        {job.status !== "paid" && (
          <button type="button" onClick={() => move("paid", `Paid ✓ ${dollars(job.priceCents)} added to Money`)} className="glow-money rounded-xl bg-ok px-3 py-1.5 text-xs font-semibold text-[#032016] transition active:scale-95">
            💵 Paid
          </button>
        )}
        {job.status === "paid" && <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">Paid ✓ in Money</span>}
        {job.status !== "scheduled" && (
          <button type="button" onClick={() => move(job.status === "paid" ? "done" : "scheduled", "Undone")} className="text-xs text-faint hover:text-ink">
            Undo
          </button>
        )}
        {job.phone && (
          <a href={`sms:${job.phone}`} className="ml-auto text-xs font-medium text-electric">
            💬 Text
          </a>
        )}
        <button
          type="button"
          aria-label="Delete job"
          onClick={() =>
            window.confirm(`Delete this job for ${job.customer}?`) &&
            startTransition(async () => {
              const r = await deleteJobAction(job.id);
              sheet.toast(r.ok ? "Job deleted" : r.error);
            })
          }
          className={cx("text-xs text-faint hover:text-danger", !job.phone && "ml-auto")}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

export type CustomerCard = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  repeatWeeks: number | null;
  defaultPriceCents: number | null;
  state: string; // "Due for a wash · 3 days over" etc.
  tone: "due" | "ok" | "scheduled" | "new" | "one-time";
  jobs: number;
};

export function CustomerItem({ c, today }: { c: CustomerCard; today: string }) {
  const sheet = useTaskSheet();
  const [booking, setBooking] = useState(false);
  const [on, setOn] = useState(today);
  const [price, setPrice] = useState(c.defaultPriceCents != null ? String(c.defaultPriceCents / 100) : "");
  const [pending, startTransition] = useTransition();
  const toneStyle = {
    due: "text-warn",
    ok: "text-muted",
    scheduled: "text-electric",
    new: "text-accent",
    "one-time": "text-faint",
  }[c.tone];
  return (
    <li className={cx("rounded-2xl border bg-raised/70 p-3", c.tone === "due" ? "border-warn/50 shadow-glow-warn" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-electric/15 font-display font-semibold text-electric">
          {c.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className={cx("text-xs", toneStyle)}>{c.state}</p>
          <p className="text-xs text-faint">
            {c.repeatWeeks ? `Every ${c.repeatWeeks} weeks` : "One-time"}
            {c.defaultPriceCents != null && ` · ${dollars(c.defaultPriceCents)}`} · {c.jobs} job{c.jobs === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="text-xs font-medium text-electric">
              📞 Call
            </a>
          )}
          {c.address && (
            <a href={mapsLink(c.address)} target="_blank" rel="noreferrer" className="text-xs font-medium text-electric">
              📍 Map
            </a>
          )}
        </div>
      </div>
      {booking ? (
        <form
          className="fade-in mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await addJobAction({ customerId: c.id, on, priceDollars: Number(price || 0) });
              if (!r.ok) return sheet.toast(r.error);
              sheet.toast(`Booked ${c.name} ✓`);
              setBooking(false);
            });
          }}
        >
          <input type="date" value={on} onChange={(e) => setOn(e.target.value)} className={cx(inputClass, "min-w-0 flex-1")} />
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$" className={cx(inputClass, "w-20")} />
          <Button type="submit" disabled={pending}>
            Book
          </Button>
          <Button type="button" variant="ghost" onClick={() => setBooking(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
            style={{ backgroundColor: GLASS, boxShadow: `0 0 14px -4px ${GLASS}` }}
          >
            📅 Book a wash
          </button>
          <button
            type="button"
            onClick={() =>
              window.confirm(`Remove ${c.name}? (Kept in the database for 7 days.)`) &&
              startTransition(async () => {
                const r = await deleteCustomerAction(c.id);
                sheet.toast(r.ok ? "Customer removed" : r.error);
              })
            }
            className="ml-auto text-xs text-faint hover:text-danger"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

export function NewCustomer() {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", address: "", price: "", repeat: 8 as number | null });
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-2xl border border-dashed border-electric/40 px-4 py-3 text-sm font-semibold text-electric transition hover:bg-electric/10">
        + New customer
      </button>
    );
  }
  return (
    <form
      className="fade-in flex flex-col gap-2 rounded-2xl border border-electric/40 bg-surface/90 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addCustomerAction({
            name: f.name,
            phone: f.phone,
            address: f.address,
            repeatWeeks: f.repeat,
            priceDollars: f.price ? Number(f.price) : null,
          });
          if (!r.ok) return sheet.toast(r.error);
          sheet.toast(`${f.name} added ✓`);
          setF({ name: "", phone: "", address: "", price: "", repeat: 8 });
          setOpen(false);
        });
      }}
    >
      <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, e.g. Mrs. Lopez" className={inputClass} />
      <div className="flex gap-2">
        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone" inputMode="tel" className={cx(inputClass, "min-w-0 flex-1")} />
        <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Usual $" inputMode="decimal" className={cx(inputClass, "w-24")} />
      </div>
      <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Address (opens in Maps)" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Every 4 weeks", v: 4 },
          { label: "Every 8 weeks", v: 8 },
          { label: "Every 12 weeks", v: 12 },
          { label: "One-time", v: null },
        ].map((o) => (
          <Chip key={o.label} active={f.repeat === o.v} onClick={() => setF({ ...f, repeat: o.v })}>
            {o.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !f.name.trim()} className="flex-1">
          Add customer
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
