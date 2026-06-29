/**
 * GE-VERIFY-1A — Native verification production certification.
 * Run: pnpm test:growth-native-verification-production-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const GROWTH_NATIVE_VERIFICATION_PRODUCTION_CERT_QA_MARKER =
  "growth-native-verification-production-cert-ge-verify-1a-v1" as const

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)])
  const prior = new Map<string, string | undefined>()
  for (const key of keys) prior.set(key, process.env[key])
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of prior.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

async function main() {
  const checks: string[] = []

  const [
    nativeEngine,
    nativeFeature,
    nativeFreshness,
    nativeDiagnostics,
    emailTypes,
    acquisitionEngine,
  ] = await Promise.all([
    import("../lib/growth/contact-verification/native-email-verification"),
    import("../lib/growth/contact-verification/native-verification-feature"),
    import("../lib/growth/contact-verification/native-verification-freshness"),
    import("../lib/growth/contact-verification/native-verification-diagnostics"),
    import("../lib/growth/contact-verification/email-verification-types"),
    import("../lib/growth/contact-verification/contact-acquisition-engine"),
  ])

  const mockDns = {
    resolveMx: async () => [{ exchange: "mx.acme.com", priority: 10 }],
    resolveTxt: async (hostname: string) =>
      hostname.startsWith("_dmarc.")
        ? [["v=DMARC1; p=reject"]]
        : [["v=spf1 include:_spf.google.com ~all"]],
  }

  // Syntax
  const invalid = await nativeEngine.verifyEmailNatively({ email: "bad", skipDns: true })
  assert.equal(invalid.status, "invalid")
  checks.push("syntax_validation")

  // MX / SPF / DMARC
  const withDns = await nativeEngine.verifyEmailNatively(
    { email: "jane@acme.com" },
    { dnsLookup: mockDns, now: () => 0 },
  )
  assert.equal(withDns.mx_checked, true)
  assert.equal(withDns.mx_exists, true)
  assert.equal(withDns.spf_present, true)
  assert.equal(withDns.dmarc_present, true)
  assert.equal(withDns.status, "valid")
  checks.push("mx_spf_dmarc")

  // Disposable / role / free
  const disposable = await nativeEngine.verifyEmailNatively({
    email: "x@mailinator.com",
    skipDns: true,
  })
  assert.equal(disposable.status, "invalid")
  checks.push("disposable_detection")

  const role = await nativeEngine.verifyEmailNatively({ email: "info@acme.com", skipDns: true })
  assert.equal(role.status, "risky")
  checks.push("role_detection")

  const free = await nativeEngine.verifyEmailNatively({ email: "jane@gmail.com", skipDns: true })
  assert.equal(free.status, "risky")
  checks.push("free_provider_detection")

  // Confidence
  assert.ok(withDns.confidence.score > 0)
  checks.push("confidence_scoring")

  // Authoritative service
  await withEnv(
    {
      GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE: "true",
      GROWTH_NATIVE_VERIFICATION_DNS_ENABLED: "true",
    },
    async () => {
      const { verifyEmailWithNativeEngine, mapNativeVerificationToProviderResult } = await import(
        "../lib/growth/contact-verification/native-verification-authoritative-service"
      )
      const { clearNativeVerificationCache } = await import(
        "../lib/growth/contact-verification/native-verification-cache"
      )
      clearNativeVerificationCache()

      const first = await verifyEmailWithNativeEngine("ops@equipify.ai", {
        skipCache: false,
        nativeVerificationDependencies: { dnsLookup: mockDns, now: () => 0 },
      })
      assert.equal(first?.provider_name, "native")
      checks.push("authoritative_provider_mapping")

      const second = await verifyEmailWithNativeEngine("ops@equipify.ai", {
        skipCache: false,
        nativeVerificationDependencies: { dnsLookup: mockDns, now: () => 0 },
      })
      assert.ok(second?.reasons.includes("cache_hit"))
      checks.push("cache")

      const mapped = mapNativeVerificationToProviderResult(withDns)
      assert.equal(mapped.provider_name, "native")
      assert.equal(mapped.email_status, "verified")
      checks.push("provider_result_mapping")
    },
  )

  // Refresh / freshness
  assert.equal(
    nativeFreshness.isNativeVerificationStale({
      verified_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    true,
  )
  assert.equal(
    nativeFreshness.isNativeVerificationStale({
      verified_at: new Date().toISOString(),
    }),
    false,
  )
  checks.push("refresh_freshness")

  // Deliverability mapping preserves invalid as risky (non-sendable)
  assert.equal(
    acquisitionEngine.mapNativeVerificationToDeliverability({
      ...withDns,
      status: "invalid",
    }),
    "risky",
  )
  checks.push("deliverability_invalid_mapping")

  // Runtime consumer wiring (source inspection)
  const emailServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-verification/email-verification-service.ts"),
    "utf8",
  )
  assert.match(emailServiceSource, /verifyEmailWithNativeEngine/)
  assert.doesNotMatch(emailServiceSource, /verifyEmailWithZeroBounce/)
  checks.push("email_verification_service_native_only")

  const guardrailSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine.ts"),
    "utf8",
  )
  assert.match(guardrailSource, /emailVerified|deliverability/)
  checks.push("guardrail_integration")

  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), "lib/growth/contact-verification/communication-strategy-engine.ts"),
      "utf8",
    ),
    /emailReady|emailVerified/,
  )
  checks.push("communication_strategy_integration")

  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), "lib/growth/contact-verification/prospect-qualification-engine.ts"),
      "utf8",
    ),
    /emailVerified|deliverability/,
  )
  checks.push("qualification_integration")

  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), "lib/growth/daily-work-queue/daily-revenue-work-queue-engine.ts"),
      "utf8",
    ),
    /requiresHumanApproval|communicationStrategy/,
  )
  checks.push("work_queue_integration")

  // Diagnostics
  const diag = nativeDiagnostics.buildNativeVerificationProductionDiagnostics({
    result: withDns,
    verified_at: new Date().toISOString(),
    cache_status: "miss",
    env: {
      GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE: "true",
      GROWTH_NATIVE_VERIFICATION_DNS_ENABLED: "true",
    } as NodeJS.ProcessEnv,
  })
  assert.equal(diag.authoritative, true)
  assert.equal(diag.result?.source, "native")
  checks.push("diagnostics")

  // Production env validation
  await withEnv(
    {
      GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE: "true",
      GROWTH_NATIVE_VERIFICATION_DNS_ENABLED: "true",
    },
    () => {
      assert.equal(nativeFeature.isNativeVerificationAuthoritative(), true)
      assert.equal(nativeFeature.isNativeVerificationDnsEnabled(), true)
      assert.equal(nativeFeature.resolveNativeVerificationSkipDns(), false)
      checks.push("production_env_validation")
    },
  )

  assert.ok(emailTypes.GROWTH_EMAIL_VERIFICATION_PROVIDER_NAMES.includes("native"))

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_NATIVE_VERIFICATION_PRODUCTION_CERT_QA_MARKER,
        certification: "PASS",
        readiness: "READY_WITH_MINOR_FIXES",
        checks_passed: checks.length,
        checks,
        remaining_blockers: [
          "catch_all_detection_not_implemented",
          "smtp_mailbox_existence_not_implemented",
          "enable_GROWTH_NATIVE_VERIFICATION_DNS_ENABLED_in_production",
          "enable_GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE_in_production",
        ],
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
