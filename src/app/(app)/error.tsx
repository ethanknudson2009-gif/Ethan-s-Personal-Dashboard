"use client";

/** Shown when something on a page fails, e.g. a form had a bad value. */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="font-medium text-red-800">Something went wrong</p>
      <p className="text-sm text-red-700">{error.message}</p>
      <button type="button" onClick={reset} className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm">
        Go back and try again
      </button>
    </div>
  );
}
