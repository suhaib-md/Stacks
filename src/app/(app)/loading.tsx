/**
 * Shown during navigation between authenticated routes.
 *
 * Deliberately neutral rather than a cover grid: this segment also covers
 * /add, /settings and /book/[id], and a grid skeleton that resolves into a form
 * is a worse lie than a plain one.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-40 animate-pulse rounded bg-surface-sunk" />
      <div className="mt-6 h-11 w-full animate-pulse rounded-card bg-surface-sunk" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-[54px] w-9 shrink-0 animate-pulse rounded-cover bg-surface-sunk" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface-sunk" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface-sunk" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
