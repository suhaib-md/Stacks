import { NextResponse } from "next/server";

/** Stable, client-actionable error codes. Keep this list in sync with docs/trd.md §5. */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "DUPLICATE_ISBN"
  | "INVALID_ISBN"
  | "UPSTREAM_TIMEOUT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "SERVER_MISCONFIGURED"
  | "INTERNAL";

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  DUPLICATE_ISBN: 409,
  INVALID_ISBN: 400,
  UPSTREAM_TIMEOUT: 504,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  SERVER_MISCONFIGURED: 500,
  INTERNAL: 500,
};

export function apiError(
  code: ErrorCode,
  message: string,
  options: { status?: number; details?: unknown } = {},
) {
  return NextResponse.json(
    { error: { code, message, ...(options.details ? { details: options.details } : {}) } },
    { status: options.status ?? DEFAULT_STATUS[code] },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Best-effort client IP, used only for login throttling. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
