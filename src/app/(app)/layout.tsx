import { AppShell } from "@/components/nav/AppShell";

/**
 * `rail` is a parallel route (`@rail`). It lets the Library put its filter
 * panel inside the shell's rail without every other route having to know the
 * rail exists — routes with nothing to add fall through to @rail/default.tsx.
 */
export default function AppLayout({
  children,
  rail,
}: {
  children: React.ReactNode;
  // Optional so the layout still satisfies Next's generated LayoutProps,
  // which describes children only.
  rail?: React.ReactNode;
}) {
  return <AppShell rail={rail}>{children}</AppShell>;
}
