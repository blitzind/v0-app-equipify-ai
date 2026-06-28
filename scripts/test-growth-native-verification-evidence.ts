/**
 * GE-EI-IMP-5D — native verification evidence certification.
 * Run: pnpm test:growth-native-verification-evidence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  aggregateNativeVerificationEvidence,
  assertNativeVerificationEvidenceHasNoPlaintextEmails,
  buildNativeVerificationEvidenceFixtures,
  buildNativeVerificationEvidenceFromPreviewReport,
  buildNativeVerificationEvidenceSummary,
  computeNativeVerificationReadinessScore,
  deriveNativeVerificationRecommendation,
  GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER,
} from "../lib/growth/contact-verification/native-verification-evidence"
import { buildNativeEmailVerificationShadowPreviewReport } from "../lib/growth/contact-verification/native-email-verification-shadow-aggregation"
import { runNativeVerificationReadiness } from "./native-verification-readiness"

function writeTempFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-verification-evidence-"))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents, "utf8")
  return filePath
}

function assertSummaryShape(summary: ReturnType<typeof buildNativeVerificationEvidenceSummary>): void {
  assert.equal(summary.qa_marker, GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER)
  assert.ok(summary.overall)
  assert.ok(summary.by_domain_type)
  assert.ok(summary.by_status)
  assert.ok(summary.by_mismatch)
  assert.ok(summary.dns_summary)
  assert.ok(typeof summary.readiness_score === "number")
  assert.ok(typeof summary.recommendation === "string")
  assert.ok(Array.isArray(summary.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-5D Native Verification Evidence Certification ===\n")

  const fixtures = buildNativeVerificationEvidenceFixtures()
  const summary = buildNativeVerificationEvidenceSummary(fixtures)
  assertSummaryShape(summary)
  assert.equal(summary.overall.total_verifications, fixtures.length)
  assert.ok(summary.overall.equivalent_matches >= 1)
  assert.ok(summary.overall.mismatches >= 1)
  assert.ok(assertNativeVerificationEvidenceHasNoPlaintextEmails(summary))
  console.log("  ✓ Aggregation produces valid evidence summary")

  const repeat = buildNativeVerificationEvidenceSummary(fixtures)
  assert.deepEqual(summary, repeat, "evidence summary must be deterministic")
  console.log("  ✓ Deterministic ordering and output")

  const aggregated = aggregateNativeVerificationEvidence(fixtures)
  assert.ok(aggregated.by_status.native.valid >= 1)
  assert.ok(aggregated.by_status.legacy.verified >= 1)
  assert.ok(aggregated.by_mismatch.verified_to_invalid >= 1)
  assert.ok(aggregated.by_mismatch.free_domain_downgrade >= 1)
  assert.ok(aggregated.by_mismatch.role_downgrade >= 1)
  assert.ok(aggregated.by_mismatch.mx_missing >= 1)
  assert.ok(aggregated.by_domain_type.business_domains >= 1)
  assert.ok(aggregated.by_domain_type.free_domains >= 1)
  console.log("  ✓ Mismatch categorization and status counts")

  const deltaEntries = fixtures.filter((entry) => typeof entry.delta === "number")
  const expectedAvg =
    deltaEntries.reduce((sum, entry) => sum + (entry.delta ?? 0), 0) / deltaEntries.length
  assert.ok(Math.abs(aggregated.overall.average_confidence_delta - expectedAvg) < 0.01)
  console.log("  ✓ Average confidence delta")

  assert.ok(aggregated.dns_summary.mx_checked >= 1)
  assert.ok(aggregated.dns_summary.dns_timeout_rate >= 0)
  console.log("  ✓ DNS signal aggregation")

  const readiness = computeNativeVerificationReadinessScore(aggregated)
  assert.ok(readiness >= 0 && readiness <= 100)
  assert.equal(summary.readiness_score, readiness)
  console.log("  ✓ Readiness score bounded 0-100")

  const recommendation = deriveNativeVerificationRecommendation({
    ...aggregated,
    readiness_score: readiness,
  })
  assert.ok(
    [
      "Continue shadow collection",
      "Native engine ready for pilot",
      "Investigate MX failures",
      "Investigate free-domain mismatches",
      "Investigate provider disagreement",
    ].includes(recommendation),
  )
  assert.equal(summary.recommendation, recommendation)
  console.log("  ✓ Recommendation logic")

  const empty = buildNativeVerificationEvidenceSummary([])
  assert.equal(empty.overall.total_verifications, 0)
  assert.equal(empty.readiness_score, 0)
  assert.equal(empty.recommendation, "Continue shadow collection")
  assert.ok(empty.warnings.includes("no_evidence_records"))
  console.log("  ✓ Empty input handled")

  const filtered = aggregateNativeVerificationEvidence(fixtures, {
    legacy_status: ["verified"],
  })
  assert.ok(filtered.overall.total_verifications < fixtures.length)
  console.log("  ✓ Optional filters")

  const previewReport = buildNativeEmailVerificationShadowPreviewReport({
    mode: "fixture",
    parseResult: {
      entries: fixtures,
      loaded: fixtures.length,
      ignored: 0,
      warnings: [],
    },
  })
  const fromPreview = buildNativeVerificationEvidenceFromPreviewReport(previewReport)
  assertSummaryShape(fromPreview)
  assert.ok(fromPreview.warnings.includes("derived_from_preview_report"))
  console.log("  ✓ Preview report conversion")

  const fixtureCli = await runNativeVerificationReadiness(["--fixture"])
  assertSummaryShape(fixtureCli)
  assert.deepEqual(fixtureCli, summary)
  console.log("  ✓ CLI fixture mode")

  const shadowFile = writeTempFile(
    "shadow.ndjson",
    fixtures.map((entry) => JSON.stringify(entry)).join("\n"),
  )
  const fileCli = await runNativeVerificationReadiness([`--shadow-file=${shadowFile}`])
  assert.equal(fileCli.overall.total_verifications, fixtures.length)
  console.log("  ✓ CLI shadow file mode")

  const previewFile = writeTempFile("preview.json", JSON.stringify(previewReport))
  const previewCli = await runNativeVerificationReadiness([`--preview-file=${previewFile}`])
  assert.ok(previewCli.overall.total_verifications === fixtures.length)
  console.log("  ✓ CLI preview file mode")

  console.log("\nGE-EI-IMP-5D native verification evidence certification passed.\n")
  console.log(
    `Current fixture readiness: score=${summary.readiness_score}, recommendation="${summary.recommendation}"`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
