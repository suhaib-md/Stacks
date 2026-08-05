import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Stacks" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only same-origin relative paths — never redirect to an attacker-supplied host.
  const destination =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Stacks</h1>
        <p className="mt-2 text-sm text-ink-muted">Your personal book catalog.</p>
        <LoginForm next={destination} />
      </div>
    </main>
  );
}
