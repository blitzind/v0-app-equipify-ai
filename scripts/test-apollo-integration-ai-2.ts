/**
 * Apollo integration AI-2 — live pilot & data quality certification.
 * Run: pnpm test:apollo-integration-ai-2
 *
 * No live Apollo HTTP in CI. Validates evidence format, analysis, and mock fixture.
 * Optional: APOLLO_AI_2_PILOT_EVIDENCE_JSON=/path/to/evidence.json
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  analyzeApolloLivePilotEvidence,
  APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER,
  projectApolloLivePilotCostScaling,
} from "../lib/growth/apollo/apollo-live-pilot-analysis"
import {
  APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
  validateApolloLivePilotEvidence,
} from "../lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  APOLLO_LIVE_PILOT_FIXTURE_QA_MARKER,
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
  "lib/growth/apollo/apollo-live-pilot-evidence-types.ts",
  "lib/growth/apollo/apollo-live-pilot-analysis.ts",
  "lib/growth/apollo/apollo-live-pilot-fixture.ts",
  "lib/growth/apollo/apollo-live-pilot-runner.ts",
  "docs/APOLLO_INTEGRATION_AI_2.md",
  "docs/APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md",
  "scripts/run-apollo-live-pilot-ai-2.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER, "apollo-live-pilot-ai-2-v1")
assert.equal(APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER, "apollo-live-pilot-analysis-ai-2-v1")
assert.equal(APOLLO_LIVE_PILOT_FIXTURE_QA_MARKER, "apollo-live-pilot-fixture-ai-2-v1")

console.log("\n=== AI-2 Evidence Format ===")
const mockEvidence = buildApolloLivePilotMockEvidence()
const validation = validateApolloLivePilotEvidence(mockEvidence)
assert.equal(validation.ok, true, validation.errors.join("; "))
record("evidence.format", "evidence", "pass", "Mock pilot evidence validates")

console.log("\n=== AI-2 Canonical Matching Analysis ===")
const analysis = analyzeApolloLivePilotEvidence(mockEvidence)
assert.equal(analysis.canonical_matching.person.created, 2)
assert.equal(analysis.canonical_matching.duplicate_risk, "low")
record("canonical.person_created", "canonical", "pass", "Person create count analyzed")
record("canonical.duplicate_risk", "canonical", "pass", `Duplicate risk: ${analysis.canonical_matching.duplicate_risk}`)

console.log("\n=== AI-2 Contact Quality ===")
assert.ok(analysis.contact_quality.decision_maker_rate > 0)
assert.ok(analysis.contact_quality.email_rate > 0)
record("quality.decision_maker", "quality", "pass", `Decision maker rate ${analysis.contact_quality.decision_maker_rate}%`)
record("quality.email", "quality", "pass", `Email rate ${analysis.contact_quality.email_rate}%`)

console.log("\n=== AI-2 Readiness Funnel ===")
assert.equal(analysis.readiness_funnel.imported, 3)
assert.equal(analysis.readiness_funnel.sequence_ready, 1)
assert.equal(analysis.readiness_funnel.fallout.contactable_to_sequence_ready, 1)
record("funnel.imported", "readiness", "pass", `Imported: ${analysis.readiness_funnel.imported}`)
record("funnel.sequence_ready", "readiness", "pass", `Sequence ready: ${analysis.readiness_funnel.sequence_ready}`)
record("funnel.fallout", "readiness", "pass", "Fallout counts computed at each stage")

console.log("\n=== AI-2 Research Pipeline ===")
assert.equal(analysis.research_pipeline.all_automated, true)
record("research.automated", "research", "pass", "All research signals present in fixture")

console.log("\n=== AI-2 Cost Analysis ===")
assert.equal(analysis.cost_per_company.contacts_mapped, 3)
const projections = projectApolloLivePilotCostScaling(mockEvidence)
assert.equal(projections.length, 3)
assert.equal(projections[0]!.companies, 100)
assert.ok(projections[2]!.estimated_contacts_mapped >= projections[0]!.estimated_contacts_mapped)
record("cost.per_company", "cost", "pass", `${analysis.cost_per_company.credits} credits, ${analysis.cost_per_company.contacts_mapped} contacts`)
record("cost.projection_100", "cost", "pass", `100 cos → ${projections[0]!.estimated_contacts_mapped} contacts`)
record("cost.projection_1000", "cost", "pass", `1000 cos → ${projections[2]!.estimated_contacts_mapped} contacts`)

console.log("\n=== AI-2 Operating Limits ===")
assert.equal(analysis.operating_limits.max_bulk_enrollment, 0)
assert.ok(analysis.operating_limits.safe_pilot_volume_per_day >= 1)
record("limits.pilot_volume", "limits", "pass", `Safe pilot ${analysis.operating_limits.safe_pilot_volume_per_day}/day`)
record("limits.no_bulk", "limits", "pass", "Bulk enrollment cap remains 0")

console.log("\n=== AI-2 Go/No-Go (mock fixture) ===")
assert.equal(analysis.go_no_go.verdict, "no_go")
assert.equal(analysis.go_no_go.ready_for_bulk_enrollment, false)
assert.ok(analysis.go_no_go.blockers.some((b) => /mock mode/i.test(b)))
record("go_no_go.mock_blocked", "go_no_go", "pass", "Mock evidence correctly blocked from production go")

const liveFixture = buildApolloLivePilotMockEvidence({
  mock: false,
  runtime: { duration_ms: 3200, api_calls: 1, credits_consumed: 0, errors: [] },
})
const liveAnalysis = analyzeApolloLivePilotEvidence(liveFixture)
assert.equal(liveAnalysis.go_no_go.verdict, "go")
assert.equal(liveAnalysis.go_no_go.ready_for_controlled_production, true)
record("go_no_go.live_fixture", "go_no_go", "pass", "Synthetic live evidence passes controlled production go")

console.log("\n=== AI-2 Live Pilot Evidence (optional) ===")
const evidencePath = process.env.APOLLO_AI_2_PILOT_EVIDENCE_JSON?.trim()
if (evidencePath && fs.existsSync(evidencePath)) {
  const parsed = JSON.parse(fs.readFileSync(evidencePath, "utf8"))
  const evidence = parsed.evidence ?? parsed
  const liveValidation = validateApolloLivePilotEvidence(evidence)
  assert.equal(liveValidation.ok, true, liveValidation.errors.join("; "))
  const livePilotAnalysis = analyzeApolloLivePilotEvidence(evidence)
  record("live.evidence", "pilot", "pass", `Validated ${evidencePath}`)
  record("live.go_no_go", "go_no_go", "pass", `Verdict: ${livePilotAnalysis.go_no_go.verdict}`)
} else {
  record(
    "live.pilot",
    "pilot",
    "manual",
    "Run pnpm run:apollo-live-pilot-ai-2 with real API key; set APOLLO_AI_2_PILOT_EVIDENCE_JSON",
  )
}

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const reportPath = path.join(process.cwd(), "docs/APOLLO_INTEGRATION_AI_2_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# Apollo Integration AI-2 Certification Report

Generated by \`pnpm test:apollo-integration-ai-2\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |

**Automated verdict:** ${fail === 0 ? "PASS" : "FAIL"}

**Live pilot verdict:** ${manual > 0 ? "PENDING — complete live pilot checklist" : "See live evidence results"}

See [APOLLO_INTEGRATION_AI_2.md](./APOLLO_INTEGRATION_AI_2.md).

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
  console.error(`\nAI-2 certification failed: ${failures.length} failure(s).`)
  process.exitCode = 1
} else {
  console.log("\nApollo integration AI-2 certification passed (automated).")
}
