/**
 * GE-EI-IMP-5A — native email verification engine certification.
 * Run: pnpm test:growth-native-email-verification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER,
  verifyEmailNatively,
  type NativeEmailVerificationDnsLookup,
} from "../lib/growth/contact-verification/native-email-verification"
import { isFreeEmailDomain } from "../lib/growth/import/email-classifiers"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockDnsLookup(input: {
  mx?: Record<string, Array<{ exchange: string; priority?: number }>>
  txt?: Record<string, string[][]>
  rejectMx?: string[]
  delayMs?: number
}): NativeEmailVerificationDnsLookup {
  return {
    resolveMx: async (domain) => {
      if (input.delayMs) await new Promise((resolve) => setTimeout(resolve, input.delayMs))
      if (input.rejectMx?.includes(domain)) throw new Error("mock_mx_failure")
      return input.mx?.[domain] ?? []
    },
    resolveTxt: async (hostname) => {
      if (input.delayMs) await new Promise((resolve) => setTimeout(resolve, input.delayMs))
      return input.txt?.[hostname] ?? []
    },
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-5A Native Email Verification Certification ===\n")

  assert.equal(GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER, "native-email-verification-v1")
  assert.equal(isFreeEmailDomain("gmail.com"), true)
  assert.equal(isFreeEmailDomain("acme.com"), false)

  const invalidSyntax = await verifyEmailNatively({ email: "not-an-email", skipDns: true })
  assert.equal(invalidSyntax.status, "invalid")
  assert.equal(invalidSyntax.syntax_valid, false)
  assert.ok(invalidSyntax.reasons.includes("invalid_syntax"))
  console.log("  ✓ Invalid syntax → invalid")

  const disposable = await verifyEmailNatively(
    { email: "user@mailinator.com", skipDns: true },
    { now: () => 0 },
  )
  assert.equal(disposable.status, "invalid")
  assert.equal(disposable.disposable, true)
  assert.ok(disposable.reasons.includes("disposable_domain"))
  console.log("  ✓ Disposable domain → invalid")

  const roleEmail = await verifyEmailNatively({ email: "info@acme.com", skipDns: true })
  assert.equal(roleEmail.role_account, true)
  assert.ok(roleEmail.reasons.includes("role_account"))
  assert.equal(roleEmail.status, "risky")
  console.log("  ✓ Role email → risky with role reason")

  const freeEmail = await verifyEmailNatively({ email: "jane@gmail.com", skipDns: true })
  assert.equal(freeEmail.free_email, true)
  assert.ok(freeEmail.reasons.includes("free_email_domain"))
  assert.equal(freeEmail.status, "risky")
  console.log("  ✓ Free email → risky")

  const businessSkipDns = await verifyEmailNatively({ email: "jane.doe@acme.com", skipDns: true })
  assert.equal(businessSkipDns.business_domain, true)
  assert.equal(businessSkipDns.mx_checked, false)
  assert.equal(businessSkipDns.status, "unknown")
  assert.ok(businessSkipDns.warnings.includes("dns_skipped"))
  console.log("  ✓ Business domain with skipDns → unknown, no DNS attempted")

  const validBusiness = await verifyEmailNatively(
    { email: "jane.doe@acme.com" },
    {
      dnsLookup: mockDnsLookup({
        mx: { "acme.com": [{ exchange: "mx.acme.com", priority: 10 }] },
        txt: {
          "acme.com": [["v=spf1 include:_spf.google.com ~all"]],
          "_dmarc.acme.com": [["v=DMARC1; p=reject"]],
        },
      }),
      now: () => 0,
    },
  )
  assert.equal(validBusiness.status, "valid")
  assert.equal(validBusiness.mx_checked, true)
  assert.equal(validBusiness.mx_exists, true)
  assert.deepEqual(validBusiness.mx_records, ["mx.acme.com"])
  assert.equal(validBusiness.spf_checked, true)
  assert.equal(validBusiness.spf_present, true)
  assert.equal(validBusiness.dmarc_checked, true)
  assert.equal(validBusiness.dmarc_present, true)
  console.log("  ✓ DNS mock with MX/SPF/DMARC → valid business email")

  const noMx = await verifyEmailNatively(
    { email: "jane.doe@nowhere.test" },
    {
      dnsLookup: mockDnsLookup({ mx: { "nowhere.test": [] } }),
      now: () => 0,
    },
  )
  assert.equal(noMx.status, "invalid")
  assert.equal(noMx.mx_exists, false)
  assert.ok(noMx.reasons.includes("mx_records_missing"))
  console.log("  ✓ DNS mock with no MX → invalid")

  const dnsFailure = await verifyEmailNatively(
    { email: "jane.doe@acme.com", timeoutMs: 50 },
    {
      dnsLookup: mockDnsLookup({ rejectMx: ["acme.com"], delayMs: 200 }),
      now: () => 0,
    },
  )
  assert.equal(dnsFailure.status, "risky")
  assert.equal(dnsFailure.mx_exists, null)
  assert.ok(dnsFailure.warnings.some((warning) => warning.includes("mx_lookup")))
  console.log("  ✓ DNS timeout/failure never throws")

  const safe = await verifyEmailNatively({ email: "jane.doe@acme.com", skipDns: true })
  assert.equal(safe.catch_all_checked, false)
  assert.equal(safe.catch_all, null)
  assert.equal(safe.smtp_checked, false)
  assert.equal(safe.smtp_verified, null)
  console.log("  ✓ SMTP/catch-all placeholders remain unchecked")

  assert.ok(safe.confidence)
  assert.ok(Array.isArray(safe.confidence.signals))
  assert.ok(safe.confidence.signals.some((signal) => signal.source === "native_syntax"))
  assert.ok(typeof safe.confidence.score === "number")
  console.log("  ✓ Confidence reused from native composite scorer")

  const engineSource = readSource("lib/growth/contact-verification/native-email-verification.ts")
  assert.doesNotMatch(engineSource, /zerobounce|apollo|email-verification-provider|verifyEmailWithProvider/i)
  assert.doesNotMatch(engineSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
  console.log("  ✓ No provider imports or database writes")

  const heuristicSource = readSource("lib/growth/contact-verification/verify-email-heuristic.ts")
  assert.match(heuristicSource, /verifyEmailAddressHeuristic/)
  assert.doesNotMatch(
    readSource("lib/growth/contact-verification/email-verification-service.ts"),
    /verifyEmailNatively/,
  )
  console.log("  ✓ Runtime verification path unchanged (engine not wired)")

  console.log("\nGE-EI-IMP-5A native email verification certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
