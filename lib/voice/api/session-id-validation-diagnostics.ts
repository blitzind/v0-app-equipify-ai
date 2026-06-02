import "server-only"

import { z } from "zod"
import { logGrowthEngine } from "@/lib/growth/access"

export const SESSION_ID_VALIDATION_DIAGNOSTICS_QA_MARKER =
  "voice-session-id-validation-diagnostics-v1" as const

export const GROWTH_CALLS_ANSWER_VALIDATION_AUDIT_QA_MARKER =
  "growth-calls-answer-validation-audit-v1" as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ZOD_UUID = z.string().uuid()

export type SessionIdValidationSnapshot = {
  rawSessionId: string | null
  trimmedSessionId: string | null
  sessionIdLength: number | null
  trimmedSessionIdLength: number | null
  zodUuidPass: boolean
  operatorUuidRegexPass: boolean
  versionNibble: string | null
  variantNibble: string | null
  sessionIdKind: string
}

export function describeSessionIdValidation(
  sessionId: string | null | undefined,
): SessionIdValidationSnapshot {
  const rawSessionId = sessionId ?? null
  const trimmedSessionId = rawSessionId?.trim() || null
  const segments = trimmedSessionId?.split("-") ?? []
  return {
    rawSessionId,
    trimmedSessionId,
    sessionIdLength: rawSessionId?.length ?? null,
    trimmedSessionIdLength: trimmedSessionId?.length ?? null,
    zodUuidPass: trimmedSessionId ? ZOD_UUID.safeParse(trimmedSessionId).success : false,
    operatorUuidRegexPass: trimmedSessionId ? UUID_RE.test(trimmedSessionId) : false,
    versionNibble: segments[2]?.[0] ?? null,
    variantNibble: segments[3]?.[0] ?? null,
    sessionIdKind: classifySessionIdKind(rawSessionId),
  }
}

export function logGrowthCallsAnswerValidationAudit(
  phase: string,
  details: Record<string, unknown> & { sessionId?: string | null },
): void {
  const validation = describeSessionIdValidation(details.sessionId)
  logGrowthEngine("growth_calls_answer_validation_audit", {
    qaMarker: GROWTH_CALLS_ANSWER_VALIDATION_AUDIT_QA_MARKER,
    phase,
    ts: new Date().toISOString(),
    ...validation,
    ...details,
  })
}

export function logVoiceOperatorSessionIdAudit(input: {
  route: string
  branch: string
  sessionId?: string | null
  sessionIdSource?: string
  dbLookupFound?: boolean | null
  dbLookupError?: string | null
  organizationId?: string | null
  httpStatus?: number
  errorCode?: string
  message?: string
}): void {
  const validation = describeSessionIdValidation(input.sessionId)
  logGrowthEngine("voice_operator_session_id_audit", {
    qaMarker: GROWTH_CALLS_ANSWER_VALIDATION_AUDIT_QA_MARKER,
    ts: new Date().toISOString(),
    route: input.route,
    branch: input.branch,
    sessionIdSource: input.sessionIdSource ?? null,
    dbLookupFound: input.dbLookupFound ?? null,
    dbLookupError: input.dbLookupError ?? null,
    organizationId: input.organizationId ?? null,
    httpStatus: input.httpStatus ?? null,
    errorCode: input.errorCode ?? null,
    message: input.message ?? null,
    ...validation,
  })
}

export type SessionIdValidationFailureInput = {
  route: string
  message: "Session id is invalid." | "Invalid session id."
  sessionId: string | null | undefined
  sessionIdSource: string
  activeVoiceCallId?: string | null
  nativeSessionId?: string | null
  realtimeSessionId?: string | null
  sessionIdPassedUuidValidation?: boolean
}

export function classifySessionIdKind(sessionId: string | null | undefined): string {
  if (sessionId == null || sessionId.trim() === "") return "null_or_empty"
  const trimmed = sessionId.trim()
  if (trimmed === "null") return "literal_null_string"
  if (trimmed === "undefined") return "literal_undefined_string"
  if (trimmed.startsWith("pending-inbound-")) return "pending_inbound_placeholder"
  if (UUID_RE.test(trimmed)) return "valid_uuid"
  return "invalid_non_uuid"
}

export function sessionIdPassedUuidValidation(sessionId: string | null | undefined): boolean {
  if (!sessionId?.trim()) return false
  return UUID_RE.test(sessionId.trim())
}

export function logSessionIdValidationFailure(input: SessionIdValidationFailureInput): void {
  const sessionId = input.sessionId?.trim() || null
  logGrowthEngine("voice_session_id_validation_failed", {
    qaMarker: SESSION_ID_VALIDATION_DIAGNOSTICS_QA_MARKER,
    route: input.route,
    message: input.message,
    sessionId,
    sessionIdSource: input.sessionIdSource,
    activeVoiceCallId: input.activeVoiceCallId ?? null,
    nativeSessionId: input.nativeSessionId ?? sessionId,
    realtimeSessionId: input.realtimeSessionId ?? null,
    sessionIdPassedUuidValidation:
      input.sessionIdPassedUuidValidation ?? sessionIdPassedUuidValidation(sessionId),
    sessionIdKind: classifySessionIdKind(sessionId),
  })
}
