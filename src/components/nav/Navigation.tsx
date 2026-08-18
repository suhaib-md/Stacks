"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Destination = { href: string; label: string; icon: React.ReactNode };

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="square"
    strokeLinejoin="miter"
    className="size-4"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const DESTINATIONS: Destination[] = [
  { href: "/", label: "Library", icon: <Icon d="M4 5h5v14H4zM11 5h4v14h-4zM17 6l3 13" /> },
  { href: "/add", label: "Add", icon: <Icon d="M3 7V5h3M21 7V5h-3M3 17v2h3M21 17v2h-3M7 12h10" /> },
  { href: "/pick", label: "Pick", icon: <Icon d="M12 3l2.4 5.4 5.6.6-4.2 4 1.2 5.8L12 16l-5 2.8 1.2-5.8-4.2-4 5.6-.6z" /> },
  { href: "/stats", label: "Stats", icon: <Icon d="M5 20V10M12 20V4M19 20v-7" /> },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * The rail's primary nav. Active is carried by accent text and a 2px accent
 * marker flush against the rule — never by a fill, which the sheet reserves for
 * a selected control.
 */
export function RailNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul>
        {DESTINATIONS.map((d) => {
          const active = isActive(pathname, d.href);
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-9 items-center gap-3 border-l-2 px-4 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-ink hover:bg-ink/[.06]"
                }`}
              >
                {d.icon}
                {d.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomTabs() {
  const pathname = usePathname();

  // The scanner is full-bleed; chrome would fight the viewfinder.
  if (pathname.startsWith("/add")) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {DESTINATIONS.map((d) => {
          const active = isActive(pathname, d.href);
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[.14em] transition-colors ${
                  active ? "text-accent" : "text-ink-muted"
                }`}
              >
                {d.icon}
                {d.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
