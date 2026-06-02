import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import {
  describeNativeSessionIdValidation,
  isNativeSessionIdFormat,
  LEGACY_OPERATOR_UUID_RE,
} from "@/lib/voice/api/native-session-id-validation"

export const SESSION_ID_VALIDATION_DIAGNOSTICS_QA_MARKER =
  "voice-session-id-validation-diagnostics-v1" as const

export const GROWTH_CALLS_ANSWER_VALIDATION_AUDIT_QA_MARKER =
  "growth-calls-answer-validation-audit-v1" as const

export type SessionIdValidationSnapshot = ReturnType<typeof describeNativeSessionIdValidation> & {
  operatorUuidRegexPass: boolean
  sessionIdKind: string
}

export function describeSessionIdValidation(
  sessionId: string | null | undefined,
): SessionIdValidationSnapshot {
  const validation = describeNativeSessionIdValidation(sessionId)
  return {
    ...validation,
    operatorUuidRegexPass: validation.legacyOperatorUuidRegexPass,
    sessionIdKind: classifySessionIdKind(sessionId),
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

export function logVoiceOperatorSessionIdAudit(
  input: Record<string, unknown> & {
    route: string
    branch: string
    sessionId?: string | null
  },
): void {
  const validation = describeSessionIdValidation(
    typeof input.sessionId === "string" ? input.sessionId : null,
  )
  logGrowthEngine("voice_operator_session_id_audit", {
    qaMarker: GROWTH_CALLS_ANSWER_VALIDATION_AUDIT_QA_MARKER,
    ts: new Date().toISOString(),
    ...validation,
    ...input,
  })
}

export type SessionIdValidationFailureInput = {
  route: string
  branch?: string
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
  if (isNativeSessionIdFormat(trimmed)) return "valid_uuid"
  if (LEGACY_OPERATOR_UUID_RE.test(trimmed)) return "legacy_regex_only_uuid"
  return "invalid_non_uuid"
}

export function sessionIdPassedUuidValidation(sessionId: string | null | undefined): boolean {
  return isNativeSessionIdFormat(sessionId)
}

export function logSessionIdValidationFailure(input: SessionIdValidationFailureInput): void {
  const sessionId = input.sessionId?.trim() || null
  const validation = describeSessionIdValidation(sessionId)
  logGrowthEngine("voice_session_id_validation_failed", {
    qaMarker: SESSION_ID_VALIDATION_DIAGNOSTICS_QA_MARKER,
    route: input.route,
    branch: input.branch ?? null,
    message: input.message,
    sessionId,
    sessionIdSource: input.sessionIdSource,
    activeVoiceCallId: input.activeVoiceCallId ?? null,
    nativeSessionId: input.nativeSessionId ?? sessionId,
    realtimeSessionId: input.realtimeSessionId ?? null,
    sessionIdPassedUuidValidation:
      input.sessionIdPassedUuidValidation ?? validation.zodUuidPass,
    sessionIdKind: validation.sessionIdKind,
    rawSessionId: validation.rawSessionId,
    trimmedSessionId: validation.trimmedSessionId,
    sessionIdLength: validation.sessionIdLength,
    trimmedSessionIdLength: validation.trimmedSessionIdLength,
    zodUuidPass: validation.zodUuidPass,
    legacyOperatorUuidRegexPass: validation.legacyOperatorUuidRegexPass,
    operatorUuidRegexPass: validation.legacyOperatorUuidRegexPass,
    versionNibble: validation.versionNibble,
    variantNibble: validation.variantNibble,
  })
}
