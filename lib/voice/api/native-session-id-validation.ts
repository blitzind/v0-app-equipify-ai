import "server-only"

import { z } from "zod"

/** Shared native session id validation — must match answer route body schema. */
export const nativeSessionIdSchema = z.string().trim().uuid()

/** Legacy operator regex (v1–v5 only). Kept for audit diffs only — do not gate requests. */
export const LEGACY_OPERATOR_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeNativeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = nativeSessionIdSchema.safeParse(trimmed)
  return parsed.success ? parsed.data : null
}

export function isNativeSessionIdFormat(value: string | null | undefined): boolean {
  return normalizeNativeSessionId(value) != null
}

export function describeNativeSessionIdValidation(value: unknown): {
  rawSessionId: string | null
  trimmedSessionId: string | null
  sessionIdLength: number | null
  trimmedSessionIdLength: number | null
  zodUuidPass: boolean
  legacyOperatorUuidRegexPass: boolean
  versionNibble: string | null
  variantNibble: string | null
} {
  const rawSessionId = typeof value === "string" ? value : null
  const trimmedSessionId = rawSessionId?.trim() || null
  const segments = trimmedSessionId?.split("-") ?? []
  return {
    rawSessionId,
    trimmedSessionId,
    sessionIdLength: rawSessionId?.length ?? null,
    trimmedSessionIdLength: trimmedSessionId?.length ?? null,
    zodUuidPass: trimmedSessionId ? nativeSessionIdSchema.safeParse(trimmedSessionId).success : false,
    legacyOperatorUuidRegexPass: trimmedSessionId ? LEGACY_OPERATOR_UUID_RE.test(trimmedSessionId) : false,
    versionNibble: segments[2]?.[0] ?? null,
    variantNibble: segments[3]?.[0] ?? null,
  }
}
