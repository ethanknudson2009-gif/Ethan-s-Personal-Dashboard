/** Shown while a page loads: soft shimmering placeholders instead of a blank screen. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading" aria-busy="true">
      <div className="shimmer h-9 w-40 rounded-xl" />
      <div className="shimmer h-40 rounded-3xl" />
      <div className="shimmer h-28 rounded-3xl" />
      <div className="shimmer h-28 rounded-3xl" />
    </div>
  );
}
