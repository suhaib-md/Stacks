"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Destination = { href: string; label: string; icon: React.ReactNode };

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const DESTINATIONS: Destination[] = [
  { href: "/", label: "Library", icon: <Icon d="M4 5h5v14H4zM11 5h4v14h-4zM17 6l3 13" /> },
  { href: "/add", label: "Add", icon: <Icon d="M3 7V5h3M21 7V5h-3M3 17v2h3M21 17v2h-3M7 12h10" /> },
  { href: "/settings", label: "Settings", icon: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 .6a7 7 0 00-2-1.2L14.5 4h-5L9 6.4a7 7 0 00-2 1.2L5 7 3 11l2 1-2 1 2 4 2-.6a7 7 0 002 1.2L9.5 20h5l.5-2.4a7 7 0 002-1.2l2 .6 2-4z" /> },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-auto hidden items-center gap-1 md:flex">
      {DESTINATIONS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          aria-current={isActive(pathname, d.href) ? "page" : undefined}
          className={`rounded-card px-3 py-2 text-sm font-medium transition-colors ${
            isActive(pathname, d.href)
              ? "bg-accent-soft text-accent"
              : "text-ink-muted hover:bg-surface-sunk hover:text-ink"
          }`}
        >
          {d.label}
        </Link>
      ))}
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {DESTINATIONS.map((d) => {
          const active = isActive(pathname, d.href);
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
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
