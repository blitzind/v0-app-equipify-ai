import type { GuardResult } from "@/lib/billing/server-guard"

/** Stable client message for any unexpected throw in create-enforcement (no secrets). */
export const ENFORCEMENT_UNABLE_VERIFY_MSG = "Unable to verify create permissions right now."

/**
 * Compact, log-safe description of a thrown value (no secrets, no full UUIDs).
 * Use only for server debug logs behind EQUIPMENT_SAVE_SERVER_DEBUG.
 */
export function describeUnknownThrown(e: unknown): string {
  const kind = typeof e
  let ctor = ""
  let isErr = ""
  let keyCount = ""
  let keySample = ""
  let msg = ""
  let plainObject = ""

  try {
    isErr = String(e instanceof Error)
  } catch {
    isErr = "unknown"
  }

  if (kind === "object" && e !== null) {
    try {
      ctor = String((e as { constructor?: { name?: string } }).constructor?.name ?? "Object")
    } catch {
      ctor = "Object"
    }
    try {
      plainObject = String(Object.getPrototypeOf(e) === Object.prototype)
    } catch {
      plainObject = "?"
    }
    try {
      const keys = Object.keys(e as object)
      keyCount = String(keys.length)
      keySample = keys.slice(0, 10).join(",")
    } catch {
      keyCount = "?"
      keySample = ""
    }
    try {
      const o = e as Record<string, unknown>
      if (typeof o.message === "string") msg = o.message.slice(0, 160)
      else if (typeof o.error === "string") msg = o.error.slice(0, 160)
      else if (typeof o.details === "string") msg = o.details.slice(0, 160)
    } catch {
      msg = ""
    }
  }

  if (!msg) {
    try {
      msg = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160)
    } catch {
      msg = "[unprintable]"
    }
  }

  return JSON.stringify({
    kind,
    ctor,
    isError: isErr,
    plainObject,
    keyCount,
    keySample: keySample.slice(0, 120),
    msg: msg.slice(0, 180),
  })
}

/** Single normalized failure for any unexpected throw in create-enforcement (never leaks raw objects). */
export function normalizeUnknownServerError(_error: unknown): GuardResult {
  return {
    ok: false,
    code: "unexpected_error",
    message: ENFORCEMENT_UNABLE_VERIFY_MSG,
    httpStatus: 500,
  }
}
