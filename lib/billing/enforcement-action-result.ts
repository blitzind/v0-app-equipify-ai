import type { GuardFailureCode, GuardResult } from "@/lib/billing/server-guard"
import {
  ENFORCEMENT_UNABLE_VERIFY_MSG,
  normalizeUnknownServerError,
} from "@/lib/billing/normalize-unknown-server-error"

export { describeUnknownThrown, ENFORCEMENT_UNABLE_VERIFY_MSG, normalizeUnknownServerError } from "@/lib/billing/normalize-unknown-server-error"

const KNOWN_CODES = new Set<string>([
  "unauthorized",
  "forbidden",
  "billing_restricted",
  "billing",
  "equipment",
  "seats",
  "feature_denied",
  "membership_error",
  "usage_unavailable",
  "unexpected_error",
])

function coerceHttpStatus(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 500
  const t = Math.trunc(n)
  return t >= 200 && t <= 599 ? t : 500
}

function coerceFailureCode(raw: unknown): GuardFailureCode {
  if (typeof raw === "string" && KNOWN_CODES.has(raw)) return raw as GuardFailureCode
  return "unexpected_error"
}

function coerceMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 800)
  return fallback
}

/**
 * Sanitize a guard-like object to a strict {@link GuardResult} (drops any extra enumerable fields).
 */
export function sanitizeGuardResultLike(result: unknown, fallbackMessage: string): GuardResult {
  if (!result || typeof result !== "object" || !("ok" in result)) {
    return normalizeUnknownServerError(result)
  }
  const r = result as GuardResult
  if (r.ok === true) return { ok: true }
  if (r.ok === false) {
    return {
      ok: false,
      code: coerceFailureCode(r.code),
      message: coerceMessage(r.message, fallbackMessage),
      httpStatus: coerceHttpStatus(r.httpStatus),
    }
  }
  return normalizeUnknownServerError(result)
}

/**
 * Prove JSON-serializability for Next.js server action responses. On failure, return normalized error.
 */
export function serializeEnforcementActionResult(input: GuardResult): GuardResult {
  try {
    const cloned = JSON.parse(JSON.stringify(input)) as GuardResult
    if (cloned && typeof cloned === "object" && "ok" in cloned) {
      if (cloned.ok === true) return { ok: true }
      if (cloned.ok === false && typeof cloned.message === "string") {
        return sanitizeGuardResultLike(cloned, ENFORCEMENT_UNABLE_VERIFY_MSG)
      }
    }
  } catch {
    /* fall through */
  }
  return normalizeUnknownServerError(input)
}
