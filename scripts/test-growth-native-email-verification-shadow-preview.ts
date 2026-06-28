/**
 * GE-EI-IMP-5C — native email verification shadow preview certification.
 * Run: pnpm test:growth-native-email-verification-shadow-preview-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  aggregateNativeEmailVerificationShadowLogs,
  assertNativeEmailVerificationShadowPreviewHasNoPlaintextEmails,
  buildNativeEmailVerificationComparisonTag,
  buildNativeEmailVerificationShadowPreviewFixtures,
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
  parseNativeEmailVerificationShadowLogText,
} from "../lib/growth/contact-verification/native-email-verification-shadow-aggregation"
import {
  loadNativeEmailVerificationShadowLogFile,
  runNativeEmailVerificationShadowPreview,
  type NativeEmailVerificationShadowPreviewReport,
} from "./native-email-verification-shadow-preview"

function writeTempFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-email-shadow-preview-"))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents, "utf8")
  return filePath
}

function assertOutputShape(output: NativeEmailVerificationShadowPreviewReport): void {
  assert.equal(output.qa_marker, GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER)
  assert.ok(output.mode === "fixture" || output.mode === "file" || output.mode === "stdin")
  assert.ok(typeof output.logs_loaded === "number")
  assert.ok(typeof output.logs_ignored === "number")
  assert.ok(output.summary)
  assert.ok(typeof output.summary.total === "number")
  assert.ok(typeof output.summary.equivalent_matches === "number")
  assert.ok(typeof output.summary.mismatches === "number")
  assert.ok(typeof output.summary.match_rate === "number")
  assert.ok(typeof output.summary.avg_confidence_delta === "number")
  assert.ok(output.by_tag)
  assert.ok(output.by_native_status)
  assert.ok(output.dns_signals)
  assert.ok(Array.isArray(output.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-5C Native Email Verification Shadow Preview Certification ===\n")

  assert.equal(
    GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
    "native-email-verification-shadow-preview-v1",
  )

  const fixture = await runNativeEmailVerificationShadowPreview(["--fixture"])
  assertOutputShape(fixture)
  assert.equal(fixture.mode, "fixture")
  assert.ok(fixture.logs_loaded > 0)
  assert.ok(fixture.summary.total === fixture.logs_loaded)
  assert.ok(assertNativeEmailVerificationShadowPreviewHasNoPlaintextEmails(fixture))
  console.log("  ✓ Fixture mode produces valid JSON")

  const fixtureRepeat = await runNativeEmailVerificationShadowPreview(["--fixture"])
  assert.deepEqual(fixture, fixtureRepeat, "fixture output must be deterministic")
  console.log("  ✓ Deterministic fixture output")

  const arrayParse = parseNativeEmailVerificationShadowLogText(
    JSON.stringify([
      {
        shadow: "native_email_verification",
        legacy_status: "verified",
        native_status: "valid",
        legacy_confidence: 0.95,
        native_confidence: 0.95,
        delta: 0,
        native_mx_checked: true,
        native_mx_exists: true,
        native_spf_present: true,
        native_dmarc_present: true,
        legacy_provider_present: true,
        email_present: true,
      },
      { shadow: "native_email_verification_error", legacy_status: "verified" },
      { shadow: "recipient_email_confidence", label: "ignore" },
    ]),
  )
  assert.equal(arrayParse.loaded, 1)
  assert.equal(arrayParse.ignored, 2)
  console.log("  ✓ JSON array parsing; unrelated logs ignored")

  const ndjsonParse = parseNativeEmailVerificationShadowLogText(
    [
      '{"shadow":"native_email_verification","legacy_status":"blocked","native_status":"invalid","legacy_confidence":0.1,"native_confidence":0.05,"delta":0.05,"native_mx_checked":true,"native_mx_exists":false,"native_spf_present":false,"native_dmarc_present":false,"legacy_provider_present":true,"email_present":true}',
      '{"shadow":"email_learning_observation","event_type":"sent"}',
      "not-json",
    ].join("\n"),
  )
  assert.equal(ndjsonParse.loaded, 1)
  assert.ok(ndjsonParse.ignored >= 2)
  console.log("  ✓ NDJSON parsing; unrelated lines ignored")

  const equivalent = buildNativeEmailVerificationComparisonTag("verified", "valid")
  assert.equal(equivalent.tag, "legacy_verified_native_valid")
  assert.equal(equivalent.is_equivalent, true)

  const equivalentBlocked = buildNativeEmailVerificationComparisonTag("blocked", "invalid")
  assert.equal(equivalentBlocked.tag, "legacy_blocked_native_invalid")
  assert.equal(equivalentBlocked.is_equivalent, true)

  const mismatch = buildNativeEmailVerificationComparisonTag("verified", "risky")
  assert.equal(mismatch.tag, "legacy_verified_native_risky")
  assert.equal(mismatch.is_equivalent, false)
  console.log("  ✓ Equivalent status mapping")

  const fixtures = buildNativeEmailVerificationShadowPreviewFixtures()
  const aggregated = aggregateNativeEmailVerificationShadowLogs(fixtures)
  assert.ok(aggregated.by_tag.legacy_verified_native_valid >= 1)
  assert.ok(aggregated.by_tag.legacy_verified_native_risky >= 1)
  assert.ok(aggregated.summary.mismatches >= 1)
  assert.ok(aggregated.summary.equivalent_matches >= 1)
  console.log("  ✓ Mismatch tag counts")

  const deltaEntries = fixtures.filter((entry) => typeof entry.delta === "number")
  const expectedAvg =
    deltaEntries.reduce((sum, entry) => sum + (entry.delta ?? 0), 0) / deltaEntries.length
  assert.ok(Math.abs(aggregated.summary.avg_confidence_delta - expectedAvg) < 0.01)
  console.log("  ✓ Average delta calculation")

  assert.ok(aggregated.dns_signals.mx_checked >= 1)
  assert.ok(aggregated.dns_signals.mismatch_when_mx_missing >= 1)
  assert.ok(aggregated.dns_signals.mismatch_when_dns_unknown >= 1)
  console.log("  ✓ DNS signal aggregation")

  const shadowFile = writeTempFile(
    "shadow.json",
    JSON.stringify([
      {
        shadow: "native_email_verification",
        legacy_status: "verified",
        native_status: "unknown",
        legacy_confidence: 0.9,
        native_confidence: 0.5,
        delta: 0.4,
        native_mx_checked: false,
        native_mx_exists: null,
        native_spf_present: null,
        native_dmarc_present: null,
        legacy_provider_present: true,
        email_present: true,
      },
    ]),
  )
  const fileMode = await runNativeEmailVerificationShadowPreview([`--shadow-file=${shadowFile}`])
  assert.equal(fileMode.mode, "file")
  assert.equal(fileMode.logs_loaded, 1)
  assert.ok(assertNativeEmailVerificationShadowPreviewHasNoPlaintextEmails(fileMode))
  console.log("  ✓ File mode loads shadow logs")

  const missingFile = loadNativeEmailVerificationShadowLogFile("/tmp/does-not-exist-native-shadow.json")
  assert.equal(missingFile.loaded, 0)
  assert.ok(missingFile.warnings.some((warning) => warning.startsWith("shadow_file_not_found")))
  console.log("  ✓ Missing shadow file handled gracefully")

  const cliOutput = execSync("tsx scripts/native-email-verification-shadow-preview.ts --fixture", {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const jsonLine = cliOutput.trim().split("\n").find((line) => line.startsWith("{"))
  assert.ok(jsonLine, "CLI must emit JSON only")
  const cliJson = JSON.parse(jsonLine) as NativeEmailVerificationShadowPreviewReport
  assertOutputShape(cliJson)
  assert.equal(cliJson.mode, "fixture")
  console.log("  ✓ Package script fixture mode emits JSON only")

  console.log("\nGE-EI-IMP-5C native email verification shadow preview certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
