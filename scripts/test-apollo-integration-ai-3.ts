/**
 * Apollo integration AI-3 — live pilot execution & production rollout certification.
 * Run: pnpm test:apollo-integration-ai-3
 *
 * No live Apollo HTTP in CI.
 * Optional: APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_INTEGRATION_AI_3_QA_MARKER,
  certifyApolloProductionRollout,
  formatApolloAi3CertificationMarkdown,
} from "../lib/growth/apollo/apollo-integration-ai-3-production-certification"
import { APOLLO_CONTACT_QUALITY_SCORE_QA_MARKER, scoreApolloContactQuality } from "../lib/growth/apollo/apollo-contact-quality-score"
import {
  buildApolloLivePilotAi3ApprovedEvidence,
  buildApolloLivePilotMockEvidence,
} from "../lib/growth/apollo/apollo-live-pilot-fixture"
import {
  APOLLO_MULTICHANNEL_READINESS_QA_MARKER,
  assessApolloMultichannelProductionReadiness,
} from "../lib/growth/apollo/apollo-multichannel-production-readiness"
import {
  APOLLO_READINESS_FUNNEL_ANALYSIS_QA_MARKER,
  analyzeApolloReadinessFunnel,
} from "../lib/growth/apollo/apollo-readiness-funnel-analysis"
import { APOLLO_ROLLOUT_PLAN_QA_MARKER, buildApolloControlledRolloutPlan } from "../lib/growth/apollo/apollo-rollout-plan"
import { analyzeApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-analysis"

type CertResult = { id: string; section: string; status: "pass" | "fail" | "skip" | "manual"; detail: string }
const results: CertResult[] = []

function record(id: string, section: string, status: CertResult["status"], detail: string): void {
  results.push({ id, section, status, detail })
  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "manual" ? "○" : "—"
  console.log(`${mark} [${section}] ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-contact-quality-score.ts",
  "lib/growth/apollo/apollo-readiness-funnel-analysis.ts",
  "lib/growth/apollo/apollo-multichannel-production-readiness.ts",
  "lib/growth/apollo/apollo-rollout-plan.ts",
  "lib/growth/apollo/apollo-integration-ai-3-production-certification.ts",
  "scripts/run-apollo-live-pilot-ai-3.ts",
  "docs/APOLLO_INTEGRATION_AI_3.md",
  "docs/APOLLO_INTEGRATION_AI_3_ROLLOUT_PLAN.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(APOLLO_INTEGRATION_AI_3_QA_MARKER, "apollo-integration-ai-3-v1")
assert.equal(APOLLO_CONTACT_QUALITY_SCORE_QA_MARKER, "apollo-contact-quality-score-ai-3-v1")
assert.equal(APOLLO_READINESS_FUNNEL_ANALYSIS_QA_MARKER, "apollo-readiness-funnel-analysis-ai-3-v1")
assert.equal(APOLLO_MULTICHANNEL_READINESS_QA_MARKER, "apollo-multichannel-readiness-ai-3-v1")
assert.equal(APOLLO_ROLLOUT_PLAN_QA_MARKER, "apollo-rollout-plan-ai-3-v1")

console.log("\n=== AI-3 Mock Evidence → Rejected ===")
const mockCert = certifyApolloProductionRollout({ evidence: buildApolloLivePilotMockEvidence() })
assert.equal(mockCert.ok, true)
assert.equal(mockCert.certification!.final_go_no_go.verdict, "rejected")
assert.equal(mockCert.certification!.final_go_no_go.approved_for_controlled_production, false)
record("go_no_go.mock_rejected", "go_no_go", "pass", "Mock evidence rejected for production")

console.log("\n=== AI-3 Live Fixture → Approved ===")
const liveEvidence = buildApolloLivePilotAi3ApprovedEvidence()
const liveCert = certifyApolloProductionRollout({
  evidence: liveEvidence,
  voice_drop_vd4_live_certified: false,
  compliance_orchestration_enabled: true,
})
assert.equal(liveCert.ok, true)
assert.equal(liveCert.certification!.final_go_no_go.verdict, "approved")
assert.equal(liveCert.certification!.final_go_no_go.approved_for_bulk_enrollment, false)
record("go_no_go.live_approved", "go_no_go", "pass", "Synthetic live evidence approved for controlled production")

console.log("\n=== AI-3 Contact Quality Score ===")
const quality = scoreApolloContactQuality(liveEvidence)
assert.ok(quality.composite_score >= 65)
assert.ok(["good", "excellent"].includes(quality.grade))
record("quality.composite", "quality", "pass", `Score ${quality.composite_score}/100 (${quality.grade})`)
record("quality.executives", "quality", "pass", `${quality.breakdown.executives} executives`)

console.log("\n=== AI-3 Readiness Funnel ===")
const funnel = analyzeApolloReadinessFunnel(liveEvidence)
assert.equal(funnel.counts.sequence_ready, 1)
assert.ok(funnel.stages.length === 5)
record("funnel.stages", "readiness", "pass", funnel.summary)

console.log("\n=== AI-3 Cost Model ===")
const analysis = analyzeApolloLivePilotEvidence(liveEvidence)
assert.equal(analysis.cost_projections.length, 3)
assert.equal(analysis.cost_projections[0]!.companies, 100)
record("cost.projections", "cost", "pass", `100 cos → ${analysis.cost_projections[0]!.estimated_api_calls} API calls`)

console.log("\n=== AI-3 Rollout Plan ===")
const rollout = buildApolloControlledRolloutPlan({ evidence: liveEvidence, analysis, quality })
assert.equal(rollout.phases.length, 3)
assert.equal(rollout.phases[0]!.companies_per_day.max, 10)
assert.equal(rollout.phases[2]!.companies_per_day.max, 100)
record("rollout.phase1", "rollout", "pass", "Phase 1: 1–10 companies/day")
record("rollout.phase3", "rollout", "pass", "Phase 3: up to 100 companies/day when criteria met")

console.log("\n=== AI-3 Multichannel Assessment ===")
const multichannel = assessApolloMultichannelProductionReadiness({
  evidence: liveEvidence,
  voice_drop_vd4_live_certified: false,
})
assert.equal(multichannel.path_safe_for_controlled_production, true)
assert.equal(multichannel.voice_drop_production_safe, false)
record("multichannel.sequence", "multichannel", "pass", "Apollo→sequence path safe")
record("multichannel.voice_drop", "multichannel", "pass", "Voice Drop blocked without VD-4")

const vd4Multichannel = assessApolloMultichannelProductionReadiness({
  evidence: liveEvidence,
  voice_drop_vd4_live_certified: true,
})
assert.equal(vd4Multichannel.voice_drop_production_safe, true)
record("multichannel.vd4_unlock", "multichannel", "pass", "Voice Drop safe when VD-4 certified")

console.log("\n=== AI-3 Certification Report ===")
const markdown = formatApolloAi3CertificationMarkdown(liveCert.certification!)
assert.match(markdown, /Final verdict/)
record("report.markdown", "certification", "pass", "Markdown report generator works")

console.log("\n=== AI-3 Live Evidence (optional) ===")
const evidencePath = process.env.APOLLO_AI_3_PILOT_EVIDENCE_JSON?.trim()
if (evidencePath && fs.existsSync(evidencePath)) {
  const parsed = JSON.parse(fs.readFileSync(evidencePath, "utf8"))
  const evidence = parsed.evidence ?? parsed
  const realCert = certifyApolloProductionRollout({
    evidence,
    voice_drop_vd4_live_certified: process.env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })
  assert.equal(realCert.ok, true)
  record("live.evidence", "pilot", "pass", `Certified ${evidencePath}`)
  record("live.verdict", "go_no_go", "pass", `Verdict: ${realCert.certification!.final_go_no_go.verdict}`)
} else {
  record(
    "live.pilot",
    "pilot",
    "manual",
    "Run pnpm run:apollo-live-pilot-ai-3 with real API key; set APOLLO_AI_3_PILOT_EVIDENCE_JSON",
  )
}

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const reportPath = path.join(process.cwd(), "docs/APOLLO_INTEGRATION_AI_3_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# Apollo Integration AI-3 Certification Report

Generated by \`pnpm test:apollo-integration-ai-3\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |

**Automated verdict:** ${fail === 0 ? "PASS" : "FAIL"}

**Production approval:** ${manual > 0 ? "PENDING — live pilot evidence required" : "See live evidence verdict"}

See [APOLLO_INTEGRATION_AI_3.md](./APOLLO_INTEGRATION_AI_3.md).

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
  console.error(`\nAI-3 certification failed: ${failures.length} failure(s).`)
  process.exitCode = 1
} else {
  console.log("\nApollo integration AI-3 certification passed (automated).")
}
