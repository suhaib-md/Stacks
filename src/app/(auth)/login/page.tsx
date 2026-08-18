import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Stacks" };

/**
 * The passphrase gate (3f). The one screen where red runs as a full field, per
 * the system's poster rule: a statement on the left, the form flush left on the
 * right. Nothing is centred and nothing floats.
 */
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
    <main className="min-h-dvh md:flex">
      <section className="flex flex-col justify-between bg-accent px-6 py-10 text-on-accent md:w-[46%] md:px-12 md:py-14">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-4 bg-on-accent" />
          <span className="disp text-base">Stacks</span>
        </div>

        <div className="mt-12 md:mt-0">
          <h1 className="disp text-[38px] leading-[1.02] md:text-[56px]">
            Everything you own, on one shelf.
          </h1>
          <p className="mt-5 max-w-md text-[13px] leading-relaxed opacity-90">
            Scan a barcode and the book is catalogued in a second — edition, length,
            genre and cover, without typing anything.
          </p>
        </div>

        <p className="mt-12 text-[11px] uppercase tracking-[.14em] opacity-75 md:mt-0">
          One passphrase · no accounts
        </p>
      </section>

      <section className="flex flex-1 items-start px-6 py-10 md:items-center md:px-12">
        <div className="w-full max-w-sm">
          <h2 className="disp text-[30px]">Unlock</h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            One passphrase opens the library. There are no accounts and nothing to sign
            up for — change the phrase in Settings whenever you like.
          </p>
          <LoginForm next={destination} />
        </div>
      </section>
    </main>
  );
}
