"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The three ways in. Phase 2 turns /add into the camera, at which point these
 * stay visible as the always-one-tap-away escape hatches the PRD requires.
 */
const TABS = [
  { href: "/add", label: "ISBN" },
  { href: "/add/search", label: "Search" },
  { href: "/add/manual", label: "Manual" },
];

export function AddNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-2" aria-label="Add method">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 flex-1 px-4 text-center text-sm font-medium leading-[2.75rem] transition-colors ${
              active
                ? "border border-accent bg-accent text-on-accent"
                : "border border-rule-control text-ink-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
