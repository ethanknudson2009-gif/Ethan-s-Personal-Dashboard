/**
 * Shared building blocks for every screen, in the dark techy style from
 * docs/09-design-direction.md. Restyle here and every page follows.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { MenuButton } from "@/components/menu";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-1 flex flex-wrap items-end justify-between gap-3">
      <div className="flex w-full min-w-0 items-start justify-between gap-3 md:w-auto">
        <div className="min-w-0">
          {subtitle && <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">{subtitle}</p>}
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
        </div>
        {/* Phones: everything not in the bottom bar is behind this button. */}
        <MenuButton />
      </div>
      {children}
    </header>
  );
}

export function Card({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-3xl border border-line bg-surface/85 p-4 shadow-card backdrop-blur transition-colors hover:border-line/80 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110 shadow-glow",
    secondary: "border border-line bg-raised text-ink hover:border-muted",
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    ghost: "text-muted hover:text-ink hover:bg-raised",
  }[variant];
  return (
    <button
      className={cx(
        "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-xl border border-line bg-raised px-3 py-2.5 text-base text-ink placeholder:text-faint outline-none transition focus:border-accent/70 focus:shadow-glow sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, className)} {...props} />;
}

/** A small glowing dot in a class's color. */
export function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
    />
  );
}

/** Tappable pill, e.g. a class or "Tomorrow" in quick add. */
export function Chip({
  active,
  color,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { active?: boolean; color?: string }) {
  return (
    <button
      type="button"
      className={cx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition active:scale-95",
        active ? "border-accent bg-accent/15 text-ink shadow-glow" : "border-line bg-raised text-muted hover:text-ink",
        className,
      )}
      {...props}
    >
      {color && <ColorDot color={color} />}
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-danger">{children}</p>;
}

/** A form error passed back in the address (?error=…). "Dismiss" clears it. */
export function ErrorBanner({ message, path }: { message: string; path: string }) {
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
      <span>{message}</span>
      <Link href={path} className="shrink-0 underline">
        Dismiss
      </Link>
    </div>
  );
}
