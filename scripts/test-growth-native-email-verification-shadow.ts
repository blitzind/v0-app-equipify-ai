/**
 * GE-EI-IMP-5B — native email verification shadow certification.
 * Run: pnpm test:growth-native-email-verification-shadow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertNativeEmailVerificationShadowLogHasNoPlaintextEmails,
  buildNativeEmailVerificationShadowLogEntry,
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
  isNativeEmailVerificationShadowEnabled,
  NATIVE_EMAIL_VERIFICATION_SHADOW_TIMEOUT_MS,
  shadowCompareNativeEmailVerification,
} from "../lib/growth/contact-verification/native-email-verification-shadow"
import type { NativeEmailVerificationResult } from "../lib/growth/contact-verification/native-email-verification"
import { isEmailReadyForLeadPromotion } from "../lib/growth/contact-verification/email-verification-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function mockNativeResult(
  overrides: Partial<NativeEmailVerificationResult> = {},
): NativeEmailVerificationResult {
  return {
    normalized_email: "jane.doe@acme.com",
    domain: "acme.com",
    local_part: "jane.doe",
    syntax_valid: true,
    domain_parsed: true,
    disposable: false,
    role_account: false,
    free_email: false,
    business_domain: true,
    mx_checked: true,
    mx_exists: true,
    mx_records: ["mx.acme.com"],
    spf_checked: true,
    spf_present: true,
    dmarc_checked: true,
    dmarc_present: true,
    catch_all_checked: false,
    catch_all: null,
    smtp_checked: false,
    smtp_verified: null,
    confidence: {
      score: 0.95,
      tier: "excellent",
      sendable: true,
      reasons: ["Base native confidence"],
      signals: [],
    },
    status: "valid",
    reasons: ["business_domain"],
    warnings: [],
    duration_ms: 1,
    engine_version: "native-email-verification-v1",
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-5B Native Email Verification Shadow Certification ===\n")

  assert.equal(GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER, "native-email-verification-shadow-v1")
  assert.equal(isNativeEmailVerificationShadowEnabled(), false)
  assert.equal(isNativeEmailVerificationShadowEnabled({ GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW: "true" }), true)
  console.log("  ✓ Flag false by default")

  let verifyCalls = 0
  await shadowCompareNativeEmailVerification(
    {
      email: "jane.doe@acme.com",
      legacyStatus: "verified",
      legacyConfidence: 0.95,
      legacyProvider: "zerobounce",
    },
    {
      verifyEmailNatively: async () => {
        verifyCalls += 1
        return mockNativeResult()
      },
    },
  )
  assert.equal(verifyCalls, 0, "flag off must not invoke native verification")
  console.log("  ✓ Flag false means no native verification / no DNS")

  const logLines: string[] = []
  const originalInfo = console.info
  console.info = (message?: unknown) => {
    if (typeof message === "string") logLines.push(message)
  }

  try {
    await withEnv({ GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW: "true" }, async () => {
      let capturedTimeout: number | undefined
      await shadowCompareNativeEmailVerification(
        {
          email: "jane.doe@acme.com",
          legacyStatus: "verified",
          legacyConfidence: 0.95,
          legacyProvider: "zerobounce",
          context: { integration: "shadow_cert" },
        },
        {
          verifyEmailNatively: async (input) => {
            verifyCalls += 1
            capturedTimeout = input.timeoutMs
            return mockNativeResult()
          },
        },
      )
      assert.equal(verifyCalls, 1)
      assert.equal(capturedTimeout, NATIVE_EMAIL_VERIFICATION_SHADOW_TIMEOUT_MS)
      assert.equal(logLines.length, 1)
      const parsed = JSON.parse(logLines[0]!) as Record<string, unknown>
      assert.equal(parsed.shadow, "native_email_verification")
      assert.equal(parsed.legacy_status, "verified")
      assert.equal(parsed.native_status, "valid")
      assert.equal(parsed.legacy_confidence, 0.95)
      assert.equal(parsed.native_confidence, 0.95)
      assert.equal(parsed.delta, 0)
      assert.equal(parsed.native_mx_checked, true)
      assert.equal(parsed.native_mx_exists, true)
      assert.equal(parsed.native_spf_present, true)
      assert.equal(parsed.native_dmarc_present, true)
      assert.equal(parsed.legacy_provider_present, true)
      assert.equal(parsed.email_present, true)
      assert.ok(assertNativeEmailVerificationShadowLogHasNoPlaintextEmails(parsed))
    })
  } finally {
    console.info = originalInfo
  }
  console.log("  ✓ Flag true runs bounded native comparison and safe logs")

  const legacyResult = {
    email: "jane.doe@acme.com",
    email_status: "verified" as const,
    confidence: 0.95,
    reasons: ["ZeroBounce valid"],
    provider_name: "zerobounce" as const,
    provider_status: "valid",
    provider_sub_status: null,
    verified_by_provider: true,
    blocked_by_suppression: false,
  }

  await withEnv({ GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW: "true" }, async () => {
    await shadowCompareNativeEmailVerification(
      {
        email: legacyResult.email,
        legacyStatus: legacyResult.email_status,
        legacyConfidence: legacyResult.confidence,
        legacyProvider: legacyResult.provider_name,
      },
      {
        verifyEmailNatively: async () => {
          throw new Error("native verifier exploded")
        },
      },
    )
  })

  assert.deepEqual(legacyResult, {
    email: "jane.doe@acme.com",
    email_status: "verified",
    confidence: 0.95,
    reasons: ["ZeroBounce valid"],
    provider_name: "zerobounce",
    provider_status: "valid",
    provider_sub_status: null,
    verified_by_provider: true,
    blocked_by_suppression: false,
  })
  assert.equal(isEmailReadyForLeadPromotion(legacyResult), true)
  console.log("  ✓ Native failure never changes legacy result")

  const entry = buildNativeEmailVerificationShadowLogEntry({
    legacyStatus: "verified",
    legacyConfidence: 0.95,
    legacyProvider: "zerobounce",
    native: mockNativeResult(),
    emailPresent: true,
    context: { note: "jane.doe@acme.com should be stripped" },
  })
  assert.equal(entry.context?.note, undefined)
  console.log("  ✓ Context email values stripped from logs")

  const serviceSource = readSource("lib/growth/contact-verification/email-verification-service.ts")
  assert.match(serviceSource, /shadowCompareNativeEmailVerification\(/)
  assert.match(serviceSource, /await emitNativeEmailVerificationShadow\(result\)/)
  assert.match(serviceSource, /return result/)
  assert.doesNotMatch(serviceSource, /verifyEmailNatively\(/)
  console.log("  ✓ Service wiring exists; native engine not inlined in service")

  const shadowSource = readSource("lib/growth/contact-verification/native-email-verification-shadow.ts")
  assert.doesNotMatch(shadowSource, /raw_payload/)
  assert.doesNotMatch(shadowSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
  console.log("  ✓ No provider payload logging or database writes")

  const acquisitionSource = readSource("lib/growth/acquisition/promote-verified-contact-to-lead.ts")
  assert.match(acquisitionSource, /not_provider_verified/)
  assert.match(acquisitionSource, /email_blocked/)
  assert.doesNotMatch(acquisitionSource, /shadowCompareNativeEmailVerification/)
  console.log("  ✓ Promotion gate unchanged")

  const providerClient = readSource("lib/growth/contact-verification/providers/zerobounce-client.ts")
  assert.match(providerClient, /verifyEmailWithZeroBounce/)
  console.log("  ✓ Provider code not removed")

  console.log("\nGE-EI-IMP-5B native email verification shadow certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
