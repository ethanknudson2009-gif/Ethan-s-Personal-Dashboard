/**
 * Shared building blocks for every screen.
 *
 * Styling is deliberately plain for Phase 1 (functionality first). In the
 * design phase we restyle THESE components and the whole app changes with
 * them: one place for buttons, inputs, cards and task rows.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-gray-200 p-4", className)}>
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-black text-white hover:bg-gray-800",
    secondary: "border border-gray-300 bg-white hover:bg-gray-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
    ghost: "text-gray-600 hover:bg-gray-100",
  }[variant];
  return (
    <button
      className={cx("rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50", styles, className)}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const inputClass = "rounded border border-gray-300 px-2 py-1.5 text-base sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "bg-white", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, className)} {...props} />;
}

/** A small colored dot for a class. */
export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** Colored label for a Cushion result: ahead / tight / behind. */
export function CushionBadge({ label, text }: { label: "ahead" | "tight" | "behind"; text: string }) {
  const styles = {
    ahead: "bg-green-50 text-green-800 border-green-200",
    tight: "bg-yellow-50 text-yellow-800 border-yellow-200",
    behind: "bg-red-50 text-red-800 border-red-200",
  }[label];
  return <span className={cx("rounded border px-1.5 py-0.5 text-xs whitespace-nowrap", styles)}>{text}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-red-600">{children}</p>;
}

/** A form error passed back in the address (?error=…). "Dismiss" clears it. */
export function ErrorBanner({ message, path }: { message: string; path: string }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span>{message}</span>
      <Link href={path} className="shrink-0 underline">
        Dismiss
      </Link>
    </div>
  );
}
