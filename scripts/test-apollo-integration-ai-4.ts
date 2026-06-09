/**
 * Apollo integration AI-4 — live pilot execution prep & evidence capture certification.
 * Run: pnpm test:apollo-integration-ai-4
 *
 * No live Apollo HTTP in CI.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER,
  buildApolloLivePilotDryRunReport,
} from "../lib/growth/apollo/apollo-live-pilot-dry-run"
import {
  APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER,
  buildApolloLivePilotEvidenceBundle,
  buildApolloLivePilotOperatorCommands,
  isApolloLivePilotEvidenceBundle,
  unwrapApolloLivePilotEvidenceBundle,
} from "../lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import {
  APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER,
  buildApolloLivePilotEnvReadinessReport,
} from "../lib/growth/apollo/apollo-live-pilot-env-readiness"
import {
  APOLLO_LIVE_PILOT_SAFETY_QA_MARKER,
  buildApolloLivePilotSafetyReport,
} from "../lib/growth/apollo/apollo-live-pilot-safety"
import {
  APOLLO_LIVE_PILOT_TEST_COMPANY_SELECTOR_QA_MARKER,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-selector"
import { certifyApolloProductionRollout } from "../lib/growth/apollo/apollo-integration-ai-3-production-certification"
import {
  buildApolloLivePilotAi3ApprovedEvidence,
  buildApolloLivePilotMockEvidence,
} from "../lib/growth/apollo/apollo-live-pilot-fixture"
import { validateApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_INTEGRATION_AI_4_QA_MARKER = "apollo-integration-ai-4-v1" as const

type CertResult = { id: string; section: string; status: "pass" | "fail" | "skip" | "manual"; detail: string }
const results: CertResult[] = []

function record(id: string, section: string, status: CertResult["status"], detail: string): void {
  results.push({ id, section, status, detail })
  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "manual" ? "○" : "—"
  console.log(`${mark} [${section}] ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-live-pilot-env-readiness.ts",
  "lib/growth/apollo/apollo-live-pilot-safety.ts",
  "lib/growth/apollo/apollo-live-pilot-dry-run.ts",
  "lib/growth/apollo/apollo-live-pilot-test-company-selector.ts",
  "lib/growth/apollo/apollo-live-pilot-evidence-bundle.ts",
  "scripts/check-apollo-live-pilot-env-ai-4.ts",
  "scripts/select-apollo-live-pilot-test-company-ai-4.ts",
  "scripts/dry-run-apollo-live-pilot-ai-4.ts",
  "docs/APOLLO_INTEGRATION_AI_4.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(APOLLO_INTEGRATION_AI_4_QA_MARKER, "apollo-integration-ai-4-v1")
assert.equal(APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER, "apollo-live-pilot-env-readiness-ai-4-v1")
assert.equal(APOLLO_LIVE_PILOT_SAFETY_QA_MARKER, "apollo-live-pilot-safety-ai-4-v1")
assert.equal(APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER, "apollo-live-pilot-dry-run-ai-4-v1")
assert.equal(APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER, "apollo-live-pilot-evidence-bundle-ai-4-v1")
assert.equal(
  APOLLO_LIVE_PILOT_TEST_COMPANY_SELECTOR_QA_MARKER,
  "apollo-live-pilot-test-company-selector-ai-4-v1",
)

console.log("\n=== AI-4 Env Readiness (no secrets) ===")
const envReport = buildApolloLivePilotEnvReadinessReport({} as NodeJS.ProcessEnv)
assert.equal(envReport.api_key.configured, false)
assert.ok(!JSON.stringify(envReport).includes("sk-"))
record("env.no_secrets", "env", "pass", "Report omits API key values")

console.log("\n=== AI-4 Dry Run (no API) ===")
const dryRun = buildApolloLivePilotDryRunReport({ env: {} as NodeJS.ProcessEnv })
assert.equal(dryRun.will_call_apollo_api, false)
assert.equal(dryRun.caps.max_companies_this_run, 1)
record("dry_run.no_api", "dry_run", "pass", "will_call_apollo_api=false")

console.log("\n=== AI-4 Safety Gates ===")
const safety = buildApolloLivePilotSafetyReport({} as NodeJS.ProcessEnv)
assert.equal(safety.outreach_triggered_by_pilot, false)
assert.equal(safety.bulk_enrollment_blocked, true)
assert.ok(safety.gates.some((g) => g.id === "mock_blocks_http"))
assert.ok(safety.gates.some((g) => g.id === "single_company_only"))
record("safety.outreach", "safety", "pass", "Pilot does not trigger outreach")
record("safety.bulk", "safety", "pass", "Bulk enrollment blocked")

console.log("\n=== AI-4 Evidence Bundle ===")
const evidence = buildApolloLivePilotAi3ApprovedEvidence()
const validation = validateApolloLivePilotEvidence(evidence)
const certification = certifyApolloProductionRollout({ evidence })
const bundle = buildApolloLivePilotEvidenceBundle({
  evidence,
  validation,
  certification: certification.certification,
  ok: true,
  output_path: "./evidence/apollo-ai-3-pilot.json",
})
assert.equal(bundle.qa_marker, APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER)
assert.ok(bundle.target_company.company_candidate_id)
assert.ok(bundle.runtime.api_calls >= 0)
assert.ok(bundle.discovery.raw_contacts_returned >= 0)
assert.ok(bundle.canonical_matching.person.created >= 0)
assert.ok(bundle.readiness_funnel.sequence_ready >= 0)
assert.ok(bundle.go_no_go)
assert.ok(bundle.operator_commands.live_pilot.includes("pnpm run:apollo-live-pilot-ai-3"))
record("bundle.fields", "evidence", "pass", "Bundle includes target, runtime, discovery, go/no-go")
record("bundle.commands", "operator", "pass", "Operator command blocks present")

const unwrapped = unwrapApolloLivePilotEvidenceBundle(bundle)
assert.equal(unwrapped.evidence.pilot_at, evidence.pilot_at)
record("bundle.unwrap", "evidence", "pass", "AI-3 harness can unwrap bundle")

assert.equal(isApolloLivePilotEvidenceBundle({ evidence: buildApolloLivePilotMockEvidence() }), false)
record("bundle.type_guard", "evidence", "pass", "Distinguishes bundle from raw evidence")

console.log("\n=== AI-4 Operator Commands ===")
const commands = buildApolloLivePilotOperatorCommands("./evidence/apollo-ai-3-pilot.json")
assert.match(commands.validate, /test:apollo-integration-ai-3/)
assert.match(commands.env_check, /check:apollo-live-pilot-env-ai-4/)
record("commands.validate", "operator", "pass", "Validation command references AI-3 harness")

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const reportPath = path.join(process.cwd(), "docs/APOLLO_INTEGRATION_AI_4_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# Apollo Integration AI-4 Certification Report

Generated by \`pnpm test:apollo-integration-ai-4\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |

**Automated verdict:** ${fail === 0 ? "PASS" : "FAIL"}

See [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md).

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
  console.error(`\nAI-4 certification failed: ${failures.length} failure(s).`)
  process.exitCode = 1
} else {
  console.log("\nApollo integration AI-4 certification passed (automated).")
}
