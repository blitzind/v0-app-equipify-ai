/**
 * Native session id validation regression checks.
 * Run: pnpm exec tsx scripts/test-native-session-id-validation.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { z } from "zod"

const LEGACY_OPERATOR_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const nativeSessionIdSchema = z.string().trim().uuid()

function normalizeNativeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = nativeSessionIdSchema.safeParse(trimmed)
  return parsed.success ? parsed.data : null
}

const PRODUCTION_REPRO_ID = "adfce408-78d2-449f-a288-52aed947a3a1"
const ZOD_ONLY_ID = "adfce408-78d2-7944-a8c2-52aed947a3a1"

assert.equal(normalizeNativeSessionId(PRODUCTION_REPRO_ID), PRODUCTION_REPRO_ID)
assert.equal(LEGACY_OPERATOR_UUID_RE.test(PRODUCTION_REPRO_ID), true)
assert.equal(nativeSessionIdSchema.safeParse(PRODUCTION_REPRO_ID).success, true)

assert.equal(nativeSessionIdSchema.safeParse(ZOD_ONLY_ID).success, true)
assert.equal(LEGACY_OPERATOR_UUID_RE.test(ZOD_ONLY_ID), false)
assert.equal(normalizeNativeSessionId(ZOD_ONLY_ID), ZOD_ONLY_ID)

const answerRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/answer/route.ts"),
  "utf8",
)
assert.match(answerRouteSource, /skipSessionIdFormatValidation: true/)
assert.match(answerRouteSource, /nativeSessionIdSchema/)

const operatorRouteSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/api/voice-operator-route.ts"),
  "utf8",
)
assert.match(operatorRouteSource, /normalizeNativeSessionId/)
assert.doesNotMatch(
  operatorRouteSource,
  /if \(!UUID_RE\.test\(sessionId\)\)/,
  "operator route must not gate on legacy UUID_RE",
)

console.log("native-session-id-validation checks passed")
