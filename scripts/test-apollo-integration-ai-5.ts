/**
 * Apollo integration AI-5 — production activation & first outreach certification.
 * Run: pnpm test:apollo-integration-ai-5
 *
 * No Apollo API calls. Validates live pilot evidence only.
 * Optional: APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json
 * Fallback:  APOLLO_AI_3_PILOT_EVIDENCE_JSON
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_INTEGRATION_AI_5_QA_MARKER,
  certifyApolloProductionActivation,
  formatApolloProductionActivationMarkdown,
  loadApolloPilotEvidenceFromJson,
} from "../lib/growth/apollo/apollo-integration-ai-5-production-activation"
import { APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER } from "../lib/growth/apollo/apollo-outreach-channel-readiness"
import { APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER, validateApolloPipelineE2E } from "../lib/growth/apollo/apollo-pipeline-e2e-validation"
import { APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER } from "../lib/growth/apollo/apollo-production-activation-limits"
import { APOLLO_QUALITY_BENCHMARK_QA_MARKER, buildApolloQualityBenchmarkReport } from "../lib/growth/apollo/apollo-quality-benchmark-report"
import { APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER } from "../lib/growth/apollo/apollo-sequence-eligibility-certification"
import {
  buildApolloLivePilotAi3ApprovedEvidence,
  buildApolloLivePilotMockEvidence,
} from "../lib/growth/apollo/apollo-live-pilot-fixture"

type CertResult = { id: string; section: string; status: "pass" | "fail" | "skip" | "manual"; detail: string }
const results: CertResult[] = []

function record(id: string, section: string, status: CertResult["status"], detail: string): void {
  results.push({ id, section, status, detail })
  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "manual" ? "○" : "—"
  console.log(`${mark} [${section}] ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-pipeline-e2e-validation.ts",
  "lib/growth/apollo/apollo-sequence-eligibility-certification.ts",
  "lib/growth/apollo/apollo-outreach-channel-readiness.ts",
  "lib/growth/apollo/apollo-quality-benchmark-report.ts",
  "lib/growth/apollo/apollo-production-activation-limits.ts",
  "lib/growth/apollo/apollo-integration-ai-5-production-activation.ts",
  "docs/APOLLO_INTEGRATION_AI_5.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(APOLLO_INTEGRATION_AI_5_QA_MARKER, "apollo-integration-ai-5-v1")
assert.equal(APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER, "apollo-pipeline-e2e-validation-ai-5-v1")
assert.equal(APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER, "apollo-sequence-eligibility-ai-5-v1")
assert.equal(APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER, "apollo-outreach-channel-readiness-ai-5-v1")
assert.equal(APOLLO_QUALITY_BENCHMARK_QA_MARKER, "apollo-quality-benchmark-ai-5-v1")
assert.equal(APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER, "apollo-production-activation-limits-ai-5-v1")

console.log("\n=== AI-5 Malformed Evidence Rejected ===")
const badCert = certifyApolloProductionActivation({ evidence: { invalid: true } })
assert.equal(badCert.ok, false)
assert.ok(badCert.errors.length > 0)
record("evidence.malformed", "evidence", "pass", "Malformed evidence rejected")

console.log("\n=== AI-5 Mock Evidence → Rejected ===")
const mockCert = certifyApolloProductionActivation({
  evidence: buildApolloLivePilotMockEvidence(),
  compliance_orchestration_enabled: true,
})
assert.equal(mockCert.ok, true)
assert.equal(mockCert.certification!.activation_decision.verdict, "rejected")
record("activation.mock_rejected", "activation", "pass", "Mock evidence rejected for production activation")

console.log("\n=== AI-5 Live Fixture → Approved ===")
const liveEvidence = buildApolloLivePilotAi3ApprovedEvidence()
const liveCert = certifyApolloProductionActivation({
  evidence: liveEvidence,
  compliance_orchestration_enabled: true,
  voice_drop_vd4_live_certified: false,
})
assert.equal(liveCert.ok, true)
assert.equal(liveCert.certification!.activation_decision.verdict, "approved")
assert.equal(liveCert.certification!.activation_decision.approved_for_bulk_enrollment, false)
record("activation.live_approved", "activation", "pass", "Synthetic live evidence approved for controlled production")

console.log("\n=== AI-5 Pipeline E2E ===")
const pipeline = validateApolloPipelineE2E(liveEvidence)
assert.equal(pipeline.counts.imported, 3)
assert.equal(pipeline.counts.sequence_ready, 1)
assert.ok(pipeline.funnel_integrity_ok)
assert.equal(pipeline.stages.length, 6)
record("pipeline.stages", "pipeline", "pass", pipeline.summary)

console.log("\n=== AI-5 Sequence Eligibility ===")
const seq = liveCert.certification!.sequence_eligibility
assert.equal(seq.sequence_ready_count, 1)
assert.equal(seq.enrollment_ready, true)
record("sequence.eligibility", "sequence", "pass", seq.summary)

console.log("\n=== AI-5 Channel Readiness ===")
const channels = liveCert.certification!.channel_readiness
assert.ok(channels.channels.some((c) => c.channel === "email" && c.status === "ready"))
assert.equal(channels.channels.find((c) => c.channel === "voice_drop")!.status, "blocked")
record("channels.email", "channels", "pass", "Email ready on live fixture")
record("channels.voice_drop", "channels", "pass", "Voice Drop blocked without VD-4")

console.log("\n=== AI-5 Quality Benchmark ===")
const benchmark = buildApolloQualityBenchmarkReport(liveEvidence)
assert.ok(benchmark.metrics.decision_maker_pct >= 50)
assert.ok(benchmark.metrics.sequence_ready_pct > 0)
assert.equal(benchmark.benchmark_grade, "strong")
record("benchmark.metrics", "quality", "pass", benchmark.summary)

console.log("\n=== AI-5 Rollout Limits ===")
const limits = liveCert.certification!.rollout_limits
assert.equal(limits.weeks.length, 4)
assert.equal(limits.bulk_enrollment_permitted, false)
assert.ok(limits.weeks[0]!.companies_per_day.max >= 1)
record("limits.week1", "rollout", "pass", `Week 1: up to ${limits.weeks[0]!.companies_per_day.max} companies/day`)
record("limits.ongoing", "rollout", "pass", `Ongoing: up to ${limits.weeks[3]!.companies_per_day.max} companies/day`)

console.log("\n=== AI-5 Activation Report ===")
const markdown = formatApolloProductionActivationMarkdown(liveCert.certification!)
assert.match(markdown, /Activation verdict/)
record("report.markdown", "certification", "pass", "Markdown report generator works")

console.log("\n=== AI-5 Live Evidence File (optional) ===")
const evidencePath =
  process.env.APOLLO_AI_5_PILOT_EVIDENCE_JSON?.trim() ||
  process.env.APOLLO_AI_3_PILOT_EVIDENCE_JSON?.trim() ||
  (fs.existsSync("./evidence/apollo-ai-3-pilot.json") ? "./evidence/apollo-ai-3-pilot.json" : null)

if (evidencePath && fs.existsSync(evidencePath)) {
  const parsed = JSON.parse(fs.readFileSync(evidencePath, "utf8"))
  const loaded = loadApolloPilotEvidenceFromJson(parsed)
  const realCert = certifyApolloProductionActivation({
    evidence: loaded.evidence,
    evidence_source: `${loaded.source_label} (${evidencePath})`,
    voice_drop_vd4_live_certified: process.env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })
  assert.equal(realCert.ok, true)
  record("live.evidence", "pilot", "pass", `Loaded ${evidencePath}`)
  record(
    "live.verdict",
    "activation",
    "pass",
    `Verdict: ${realCert.certification!.activation_decision.verdict}`,
  )
  record(
    "live.pipeline",
    "pipeline",
    "pass",
    realCert.certification!.pipeline.summary,
  )
} else {
  record(
    "live.pilot",
    "pilot",
    "manual",
    "Run pnpm run:apollo-live-pilot-ai-3; set APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json",
  )
}

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const reportPath = path.join(process.cwd(), "docs/APOLLO_INTEGRATION_AI_5_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# Apollo Integration AI-5 Certification Report

Generated by \`pnpm test:apollo-integration-ai-5\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |

**Automated verdict:** ${fail === 0 ? "PASS" : "FAIL"}

**Production activation:** ${manual > 0 ? "PENDING — load live pilot evidence JSON" : "See live evidence verdict"}

See [APOLLO_INTEGRATION_AI_5.md](./APOLLO_INTEGRATION_AI_5.md).

## Results

| ID | Section | Status | Detail |
|----|---------|--------|--------|
${table}
`,
    "utf8",
  )
  console.log(`\nWrote ${reportPath}`)
}

const failures = results.filter((r) => r.status === "fail")
writeReport()

if (failures.length > 0) {
  console.error(`\nAI-5 certification failed: ${failures.length} failure(s).`)
  process.exitCode = 1
} else {
  console.log("\nApollo integration AI-5 certification passed (automated).")
}
