/**
 * Apollo Content Quality Optimization — Phase 11 certification.
 * Run: pnpm test:apollo-content-quality-optimization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { APOLLO_CONTENT_QUALITY_QA_MARKER } from "../lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"
import { EMAIL_VARIATION_ENGINE_QA_MARKER } from "../lib/growth/outreach/personalization/email-variation-engine"
import { evaluateApolloCtaQuality } from "../lib/growth/apollo/apollo-content-quality/evaluate-apollo-cta-quality"
import { evaluateApolloSubjectQuality } from "../lib/growth/apollo/apollo-content-quality/evaluate-apollo-subject-quality"
import { evaluateApolloResearchUtilization } from "../lib/growth/apollo/apollo-content-quality/evaluate-apollo-research-utilization"
import { evaluateApolloContentQuality } from "../lib/growth/apollo/apollo-content-quality/evaluate-apollo-content-quality"
import { runApolloContentBenchmarkHarness } from "../lib/growth/apollo/apollo-content-quality/apollo-content-benchmark-harness"
import { buildApolloContentFixture } from "../lib/growth/apollo/apollo-content-quality/apollo-content-fixtures"
import { isGenericSubjectPattern } from "../lib/growth/outreach/personalization/subject-intelligence"
import { isWeakGenericCta } from "../lib/growth/outreach/personalization/cta-intelligence"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/outreach/personalization/email-variation-engine.ts",
  "lib/growth/apollo/apollo-content-quality/apollo-content-quality-types.ts",
  "lib/growth/apollo/apollo-content-quality/evaluate-apollo-cta-quality.ts",
  "lib/growth/apollo/apollo-content-quality/evaluate-apollo-subject-quality.ts",
  "lib/growth/apollo/apollo-content-quality/evaluate-apollo-research-utilization.ts",
  "lib/growth/apollo/apollo-content-quality/evaluate-apollo-content-quality.ts",
  "lib/growth/apollo/apollo-content-quality/apollo-content-fixtures.ts",
  "lib/growth/apollo/apollo-content-quality/apollo-content-benchmark-harness.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing file: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(EMAIL_VARIATION_ENGINE_QA_MARKER, "email-variation-engine-v11a")
console.log("  ✓ email variation engine marker")

const fixture = buildApolloContentFixture(3)
const ctaWeak = evaluateApolloCtaQuality({ body: "Worth comparing notes on this." })
assert.equal(ctaWeak.is_weak, true)
const ctaStrong = evaluateApolloCtaQuality({
  body: "Open to a 15-minute workflow review next week?",
  companyName: fixture.packet.companyName,
})
assert.equal(ctaStrong.is_weak, false)
assert.ok(ctaStrong.score >= 70)
console.log("  ✓ CTA quality evaluation")

const subjectGeneric = evaluateApolloSubjectQuality({
  subject: "Following up",
  companyName: "Summit Medical",
})
assert.equal(subjectGeneric.is_generic, true)
const subjectStrong = evaluateApolloSubjectQuality({
  subject: "Dispatch workflow — Summit Medical",
  companyName: "Summit Medical",
})
assert.equal(subjectStrong.is_generic, false)
console.log("  ✓ subject quality evaluation")

const research = evaluateApolloResearchUtilization({
  packet: fixture.packet,
  unifiedContext: fixture.unifiedContext,
  subject: "Dispatch workflow — Summit Medical",
  body: fixture.packet.researchPainPoints[0] ?? fixture.packet.companyName,
})
assert.ok(research.sources_available.length > 0)
assert.ok(typeof research.research_utilization_score === "number")
console.log("  ✓ research utilization scoring")

const emailQuality = evaluateApolloContentQuality({
  channel: "email",
  subject: "Dispatch workflow — Summit Medical",
  body: `Hi Alex, noticed dispatch coordination delays. Open to a brief workflow review?`,
  packet: fixture.packet,
  unifiedContext: fixture.unifiedContext,
})
assert.ok(emailQuality.quality_score > 0)
assert.ok(emailQuality.quality_breakdown.personalization != null)
console.log("  ✓ unified content quality scoring")

assert.equal(isWeakGenericCta("Worth comparing notes?"), true)
assert.equal(isGenericSubjectPattern("Checking in"), true)
console.log("  ✓ wired variation guards in outreach personalization")

console.log("\n  Running content benchmark harness (100 emails, 100 SMS, 50 voice, 50 calls)…")
const report = runApolloContentBenchmarkHarness()

assert.equal(report.qa_marker, APOLLO_CONTENT_QUALITY_QA_MARKER)
assert.equal(report.counts.emails, 100)
assert.equal(report.counts.sms, 100)
assert.equal(report.counts.voice_drops, 50)
assert.equal(report.counts.call_plans, 50)
assert.equal(report.weakest_samples.length, 20)

console.log("\n=== Apollo Content Quality Benchmark Report ===")
console.log(`  duplicate_openings:     ${report.duplicate_opening_pct}% (target <10%)`)
console.log(`  duplicate_subjects:     ${report.duplicate_subject_pct}%`)
console.log(`  duplicate_ctas:         ${report.duplicate_cta_pct}%`)
console.log(`  weak_ctas:              ${report.weak_cta_pct}% (target <15%)`)
console.log(`  generic_subjects:       ${report.generic_subject_pct}% (target <5%)`)
console.log(`  research_utilization:   ${report.research_utilization_avg}% avg`)
console.log(`  research_when_evidence: ${report.research_utilization_when_evidence_pct}% (target 80%+)`)
console.log(`  email_quality:          ${report.channel_scores.email}/10`)
console.log(`  sms_quality:            ${report.channel_scores.sms}/10`)
console.log(`  voice_drop_quality:     ${report.channel_scores.voice_drop}/10`)
console.log(`  call_plan_quality:      ${report.channel_scores.call_plan}/10`)

if (report.threshold_notes.length > 0) {
  console.log("\n  Threshold notes:")
  for (const note of report.threshold_notes) {
    console.log(`    - ${note}`)
  }
}

console.log("\n  Top 5 weakest samples:")
for (const sample of report.weakest_samples.slice(0, 5)) {
  console.log(
    `    ${sample.id} [${sample.channel}] score=${sample.quality.quality_score} issues=${sample.quality.issues.join(",")}`,
  )
}

assert.ok(report.duplicate_opening_pct < 10, `duplicate openings ${report.duplicate_opening_pct}% >= 10%`)
assert.ok(report.weak_cta_pct < 15, `weak CTAs ${report.weak_cta_pct}% >= 15%`)
assert.ok(report.generic_subject_pct < 5, `generic subjects ${report.generic_subject_pct}% >= 5%`)
if (report.research_utilization_when_evidence_pct > 0) {
  assert.ok(
    report.research_utilization_when_evidence_pct >= 80,
    `research utilization ${report.research_utilization_when_evidence_pct}% < 80%`,
  )
}
assert.ok(report.passes_thresholds, `benchmark thresholds failed: ${report.threshold_notes.join("; ")}`)

console.log("\n  ✓ benchmark harness thresholds")
console.log("\nApollo Content Quality Optimization — Phase 11 certification PASSED")
