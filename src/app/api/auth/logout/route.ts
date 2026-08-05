import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { apiOk } from "@/lib/http";

export async function POST() {
  const res = apiOk({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
