import { AppShell } from "@/components/nav/AppShell";

/** Every authenticated screen shares the nav chrome. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
