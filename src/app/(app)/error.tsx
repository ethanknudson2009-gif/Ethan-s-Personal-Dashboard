"use client";

/** Shown when something on a page fails unexpectedly. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-5 shadow-glow-danger">
      <p className="font-display text-lg font-semibold text-danger">Something went wrong</p>
      <p className="text-sm text-muted">This page hit an error. Your data is safe. Try again, and if it keeps happening, tell Claude what you clicked.</p>
      <button type="button" onClick={reset} className="rounded-xl border border-line bg-raised px-4 py-2 text-sm font-semibold">
        Try again
      </button>
    </div>
  );
}
