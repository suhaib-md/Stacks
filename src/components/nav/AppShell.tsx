import Link from "next/link";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { BottomTabs, RailNav } from "./Navigation";

/**
 * Shared chrome. Direction 1b — "the ledger".
 *
 * Desktop: a permanent left rail that never collapses or hides, holding the
 * wordmark, primary nav, a per-route slot (the Library puts its filters there)
 * and the two standing actions. Mobile: the same nav as a bottom tab bar.
 *
 * Regions are separated by 2px ink rules and nothing else — no shadow, no
 * radius, no floating panels. See docs/uiux.md.
 */
export function AppShell({
  children,
  rail,
}: {
  children: React.ReactNode;
  /** Route-specific rail content, supplied by the `@rail` parallel route. */
  rail?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:flex">
      {/* Rail — desktop only. Sticky full height so the filters stay put while
          the shelf scrolls past them. */}
      <div className="hidden w-[248px] shrink-0 border-r-2 border-rule bg-surface-sunk md:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <Link
            href="/"
            className="flex items-center gap-3 border-b-2 border-rule px-4 py-4"
          >
            <span aria-hidden="true" className="size-4 shrink-0 bg-accent" />
            <span className="disp text-base">Stacks</span>
          </Link>

          <div className="border-b-2 border-rule py-2">
            <RailNav />
          </div>

          {/* Grows and scrolls independently: a long genre list must never push
              the standing actions off the bottom. */}
          <div className="min-h-0 flex-1 overflow-y-auto">{rail}</div>

          <div className="mt-auto border-t-2 border-rule">
            <a
              href="/api/export/csv"
              download
              className="block px-4 py-2.5 text-[13px] font-medium hover:bg-ink/[.06]"
            >
              Export CSV
            </a>
            <Link
              href="/settings"
              className="block px-4 py-2.5 text-[13px] font-medium hover:bg-ink/[.06]"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile wordmark bar. The rail's job on a phone is done by the tabs. */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-rule bg-paper px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden="true" className="size-3.5 bg-accent" />
          <span className="disp text-sm">Stacks</span>
        </Link>
        <Link href="/settings" className="lbl ml-auto text-ink-muted">
          Settings
        </Link>
      </header>

      {/* pb-24 clears the mobile tab bar; md drops it once the bar is gone. */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-7">
        <OfflineBanner />
        {children}
      </main>

      <BottomTabs />
      <ServiceWorker />
    </div>
  );
}
