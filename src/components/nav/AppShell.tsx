import Link from "next/link";
import { BottomTabs, TopNav } from "./Navigation";

/**
 * Shared chrome for every authenticated screen.
 * Mobile: bottom tab bar. Desktop: top nav. See docs/uiux.md §8.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            Stacks
          </Link>
          <TopNav />
        </div>
      </header>

      {/* pb-20 clears the mobile tab bar; md:pb-8 drops it once the bar is gone. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-4 md:pb-8">
        {children}
      </main>

      <BottomTabs />
    </div>
  );
}
