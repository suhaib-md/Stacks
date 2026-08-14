import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Session gate.
 *
 * Deliberately still `middleware.ts` and not Next 16's `proxy.ts`. Proxy runs on
 * the Node runtime with no way to opt out ("Proxy does not support Edge runtime"),
 * and @opennextjs/cloudflare rejects Node middleware outright. The deprecation
 * warning on every build is the cost of an app that builds at all. Revisit when
 * the adapter supports Node proxy.
 */
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const { env } = await getCloudflareContext({ async: true });
  const secret = env.SESSION_SECRET;

  // Fail closed. A missing secret must never mean "everyone is authenticated".
  const authed = secret
    ? await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret)
    : false;

  if (authed) return NextResponse.next();

  // API callers get a status they can act on; browsers get the login page.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", req.url);
  // Preserve the destination so a bookmarked deep link survives login.
  const next = pathname + req.nextUrl.search;
  if (next !== "/") loginUrl.searchParams.set("next", next);

  const res = NextResponse.redirect(loginUrl);
  if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    //
    // `icon.png` and `apple-icon.png` are generated routes from Next's file
    // conventions, not files under /icons — leave them out and the gate
    // redirects them to /login, so the tab icon is missing on the one page a
    // signed-out visitor ever sees.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons/|fonts/|manifest.webmanifest|sw.js).*)",
  ],
};
