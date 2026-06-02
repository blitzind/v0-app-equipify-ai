/**
 * Capture answer validation audit log payloads for known session ids.
 * Run: pnpm exec tsx scripts/repro-answer-validation-audit.ts
 */
import assert from "node:assert/strict"
import { z } from "zod"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ZOD_UUID = z.string().uuid()
const QA_MARKER = "growth-calls-answer-validation-audit-v1"

const PRODUCTION_SESSION_ID = "9d8952d4-c5ca-4944-a8c2-5c9c4fdd6f9d"
const ZOD_PASS_OPERATOR_FAIL_SESSION_ID = "9d8952d4-c5ca-7944-a8c2-5c9c4fdd6f9d"

function describeSessionIdValidation(sessionId: string | null | undefined) {
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
  }
}

const captured: Array<Record<string, unknown>> = []
console.info = (message?: unknown) => {
  const text = typeof message === "string" ? message : String(message)
  if (text.startsWith("{")) captured.push(JSON.parse(text) as Record<string, unknown>)
}

function emitGrowthAudit(phase: string, sessionId: string, extra: Record<string, unknown> = {}) {
  captured.push({
    source: "growth-engine",
    event: "growth_calls_answer_validation_audit",
    qaMarker: QA_MARKER,
    phase,
    ts: new Date().toISOString(),
    ...describeSessionIdValidation(sessionId),
    ...extra,
    sessionId,
  })
}

function emitOperatorAudit(input: Record<string, unknown> & { sessionId: string }) {
  captured.push({
    source: "growth-engine",
    event: "voice_operator_session_id_audit",
    qaMarker: QA_MARKER,
    ts: new Date().toISOString(),
    ...describeSessionIdValidation(input.sessionId),
    ...input,
  })
}

function emitValidationFailed(sessionId: string) {
  captured.push({
    source: "growth-engine",
    event: "voice_session_id_validation_failed",
    qaMarker: "voice-session-id-validation-diagnostics-v1",
    route: "POST /api/platform/growth/calls/answer",
    message: "Session id is invalid.",
    sessionId: sessionId.trim(),
    sessionIdSource: "json_body.sessionId",
    sessionIdPassedUuidValidation: false,
    sessionIdKind: "invalid_non_uuid",
  })
}

function simulateAnswerOperatorGuard(sessionId: string) {
  captured.length = 0
  emitGrowthAudit("pre_operator_guard", sessionId, { branch: "zod_accepted" })

  const trimmed = sessionId.trim()
  const route = "POST /api/platform/growth/calls/answer"
  const sessionIdSource = "json_body.sessionId"

  if (!UUID_RE.test(trimmed)) {
    emitValidationFailed(sessionId)
    emitOperatorAudit({
      route,
      branch: "invalid_id_uuid_regex_failed",
      sessionId,
      sessionIdSource,
      httpStatus: 400,
      errorCode: "invalid_id",
      message: "Session id is invalid.",
    })
    emitGrowthAudit("operator_guard_rejected", sessionId, { branch: "operator_guard_rejected" })
    return {
      finalStatus: 400,
      finalError: "invalid_id",
      finalMessage: "Session id is invalid.",
      finalLine: "lib/voice/api/voice-operator-route.ts:154",
    }
  }

  emitOperatorAudit({ route, branch: "uuid_regex_passed", sessionId, sessionIdSource })
  emitOperatorAudit({
    route,
    branch: "db_lookup_not_found",
    sessionId,
    sessionIdSource,
    dbLookupFound: false,
    dbLookupError: null,
  })
  emitGrowthAudit("operator_guard_rejected", sessionId, { branch: "operator_guard_rejected" })
  return {
    finalStatus: 404,
    finalError: "not_found",
    finalMessage: "Call session not found.",
    finalLine: "lib/voice/api/voice-operator-route.ts:177",
  }
}

const productionSnapshot = describeSessionIdValidation(PRODUCTION_SESSION_ID)
assert.equal(productionSnapshot.zodUuidPass, true)
assert.equal(productionSnapshot.operatorUuidRegexPass, true)

const mismatchSnapshot = describeSessionIdValidation(ZOD_PASS_OPERATOR_FAIL_SESSION_ID)
assert.equal(mismatchSnapshot.zodUuidPass, true)
assert.equal(mismatchSnapshot.operatorUuidRegexPass, false)

for (const [label, sessionId] of [
  ["production_session_id", PRODUCTION_SESSION_ID],
  ["zod_pass_operator_regex_fail", ZOD_PASS_OPERATOR_FAIL_SESSION_ID],
] as const) {
  const path = simulateAnswerOperatorGuard(sessionId)
  const validation = describeSessionIdValidation(sessionId)
  const operatorLogs = captured.filter((entry) => entry.event === "voice_operator_session_id_audit")
  const branchSelected =
    operatorLogs.find((entry) => String(entry.branch).includes("invalid_id"))?.branch ??
    operatorLogs.at(-1)?.branch ??
    null

  process.stdout.write(
    `${JSON.stringify({
      label,
      rawSessionId: validation.rawSessionId,
      trimmedSessionIdLength: validation.trimmedSessionIdLength,
      versionNibble: validation.versionNibble,
      variantNibble: validation.variantNibble,
      operatorUuidRegexPass: validation.operatorUuidRegexPass,
      branchSelected,
      dbLookupReached: operatorLogs.some((entry) =>
        ["db_lookup_found", "db_lookup_not_found", "db_lookup_error"].includes(String(entry.branch)),
      ),
      finalLine: path.finalLine,
      growth_calls_answer_validation_audit: captured.filter(
        (entry) => entry.event === "growth_calls_answer_validation_audit",
      ),
      voice_operator_session_id_audit: operatorLogs,
      voice_session_id_validation_failed: captured.filter(
        (entry) => entry.event === "voice_session_id_validation_failed",
      ),
    })}\n`,
  )
}
