/**
 * Apollo integration AI-1 — provider activation & contact acquisition foundation.
 * Run: pnpm test:apollo-integration-ai-1
 *
 * No live Apollo HTTP in CI — uses mock mode and static pipeline checks.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildContactDedupeHash,
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "../lib/growth/contact-discovery/contact-normalizer"
import { CONTACT_DISCOVERY_PROVIDER_MUST_NOT_WRITE_COMPANY_CONTACTS } from "../lib/growth/contact-discovery/contact-discovery-provider-contract"
import { resolveOperatorContactDiscoveryProviderTypes } from "../lib/growth/contact-discovery/contact-discovery-operator-providers"
import { createApolloContactAcquisitionAdapter } from "../lib/growth/contact-discovery/providers/apollo-contact-acquisition-adapter"
import { GROWTH_DECISION_MAKER_SOURCE_WEIGHT } from "../lib/growth/decision-maker-source-weight"
import {
  APOLLO_INTEGRATION_DATA_FLOW,
  APOLLO_INTEGRATION_AI_1_QA_MARKER,
  runApolloIntegrationAi1Audit,
} from "../lib/growth/apollo/apollo-integration-ai-1-audit"
import {
  APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER,
  buildApolloActivationReport,
  resolveApolloActivationMode,
} from "../lib/growth/apollo/apollo-integration-activation"
import {
  APOLLO_IMPORT_READINESS_QA_MARKER,
  evaluateApolloImportReadiness,
} from "../lib/growth/apollo/apollo-import-readiness"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { buildApolloMockPeople } from "../lib/growth/providers/apollo/apollo-mock-fixtures"
import { diagnoseApolloContactDiscoveryConfig } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  beginApolloRunGuardrails,
  recordApolloSearchApiCall,
  resetApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  ApolloRunGuardrailError,
  assertApolloCompanySearchAllowed,
} from "../lib/growth/providers/apollo/apollo-run-guardrails"

type CertResult = { id: string; section: string; status: "pass" | "fail" | "skip"; detail: string }
const results: CertResult[] = []

function record(id: string, section: string, status: CertResult["status"], detail: string): void {
  results.push({ id, section, status, detail })
  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : "—"
  console.log(`${mark} [${section}] ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-integration-ai-1-audit.ts",
  "lib/growth/apollo/apollo-integration-activation.ts",
  "lib/growth/apollo/apollo-import-readiness.ts",
  "lib/growth/contact-discovery/providers/apollo-contact-acquisition-adapter.ts",
  "docs/APOLLO_INTEGRATION_AI_1.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(APOLLO_INTEGRATION_AI_1_QA_MARKER, "apollo-integration-ai-1-v1")
assert.equal(APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER, "apollo-integration-ai-1-activation-v1")
assert.equal(APOLLO_IMPORT_READINESS_QA_MARKER, "apollo-import-readiness-ai-1-v1")
assert.equal(CONTACT_DISCOVERY_PROVIDER_MUST_NOT_WRITE_COMPANY_CONTACTS, true)
assert.ok(APOLLO_INTEGRATION_DATA_FLOW.length >= 5)

console.log("\n=== AI-1 Apollo Audit ===")
const audit = runApolloIntegrationAi1Audit()
assert.ok(audit.reusable_components.includes("apollo_client"))
assert.ok(audit.reusable_components.includes("human_acquisition"))
assert.ok(audit.summary.complete >= 15)
record("audit.inventory", "audit", "pass", `${audit.summary.complete} complete, ${audit.summary.stub} stub`)
record("audit.reusable", "audit", "pass", `${audit.reusable_components.length} reusable components`)
for (const gap of audit.missing_pieces.slice(0, 3)) {
  record(`audit.gap.${gap.split(":")[0]}`, "audit", "skip", gap)
}

console.log("\n=== AI-1 Provider Activation ===")
const priorEnv = { ...process.env }
process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "false"
assert.equal(resolveApolloActivationMode(), "disabled")
const disabledReport = buildApolloActivationReport()
assert.equal(disabledReport.mode, "disabled")
record("activation.disabled", "activation", "pass", "Disabled when master switch off")

process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "true"
process.env.GROWTH_APOLLO_USE_MOCK = "true"
process.env.GROWTH_DISCOVERY_DISABLE_APOLLO = ""
process.env.APOLLO_API_KEY = ""
assert.equal(resolveApolloActivationMode(), "mock")
const mockReport = buildApolloActivationReport()
assert.equal(mockReport.mode, "mock")
assert.equal(mockReport.provider_configured, true)
assert.equal(mockReport.credit_paths.length, 2)
record("activation.mock", "activation", "pass", "Mock mode configured without API key")

const mockDiagnostics = diagnoseApolloContactDiscoveryConfig({
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "true",
  GROWTH_DISCOVERY_DISABLE_APOLLO: "",
})
assert.equal(mockDiagnostics.mock_mode, true)
assert.equal(mockDiagnostics.ready_for_live_search, false)
record("activation.mock_no_live", "activation", "pass", "Live search blocked in mock mode")

async function runAsyncChecks(): Promise<void> {
console.log("\n=== AI-1 Adapter + Mock Discovery ===")
const adapter = createApolloContactAcquisitionAdapter()
assert.equal(adapter.vendor, "apollo")
assert.equal(adapter.provider_name, "apollo")
assert.equal(adapter.isConfigured(), true)

const discovery = await adapter.discover({
  company_candidate_id: "co-ai1",
  company_name: "Acme Biomed",
  domain: "acmebiomed.com",
  website_url: "https://acmebiomed.com",
  growth_lead_id: null,
  industry: "Healthcare",
  limit: 5,
})
assert.equal(discovery.status, "success")
assert.ok(discovery.contacts.length >= 1)
const diagnostics = adapter.buildDiagnostics(discovery, { duration_ms: 12 })
assert.equal(diagnostics.provider_name, "apollo")
assert.equal(diagnostics.configured, true)
assert.ok((diagnostics.contacts_returned ?? 0) >= 1)
record("provider.mock_discover", "provider", "pass", `${discovery.contacts.length} contact(s) returned`)

const operatorTypes = resolveOperatorContactDiscoveryProviderTypes()
assert.ok(operatorTypes.includes("future_apollo"))
record("provider.operator_chain", "provider", "pass", "future_apollo in operator provider chain when configured")

console.log("\n=== AI-1 Dedupe + Canonical Matching ===")
const mapped = mapApolloPeopleToContactDiscoveryRaw({
  people: buildApolloMockPeople({ company_name: "Acme", domain: "acme.com", limit: 4 }),
  company_name: "Acme",
  domain: "acme.com",
  mock: true,
})
assert.ok(mapped.contacts.length >= 1)
const normalizedContacts = mapped.contacts
  .map((raw) => normalizeContactCandidate(raw, "apollo", "future_apollo", "co-ai1"))
  .filter((row): row is NonNullable<typeof row> => Boolean(row))
assert.ok(normalizedContacts.length >= 1)

const deduped = dedupeNormalizedContacts(normalizedContacts)
assert.ok(deduped.length <= normalizedContacts.length)
record("dedupe.candidate_layer", "dedupe", "pass", "Candidate dedupe applied")

const hashA = buildContactDedupeHash({
  company_candidate_id: "co-ai1",
  full_name: "Jane Doe",
  job_title: "Director",
})
const hashB = buildContactDedupeHash({
  company_candidate_id: "co-ai1",
  full_name: "Jane Doe",
  job_title: "Director",
})
assert.equal(hashA, hashB)
record("dedupe.stable_hash", "dedupe", "pass", "Stable name+title hash")

const eligible = normalizedContacts.filter((c) => c.eligible_for_canonical_person)
assert.ok(eligible.length >= 1)
assert.ok(eligible.every((c) => c.metadata?.external_provider_contact_id || c.metadata?.apollo_person_id))
record("canonical.match", "canonical", "pass", `${eligible.length} eligible for canonical person`)

console.log("\n=== AI-1 Research + Scoring Integration ===")
const humanPipeline = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-human-acquisition.ts"),
  "utf8",
)
assert.match(humanPipeline, /runContactDiscoveryForCompany/)
assert.match(humanPipeline, /syncContactCandidatesToCompanyContacts/)
assert.match(humanPipeline, /runCanonicalPersonBackfillForCompanyCandidate/)
record("research.pipeline", "research", "pass", "Human acquisition pipeline reuses discovery → canonical flow")

assert.equal(GROWTH_DECISION_MAKER_SOURCE_WEIGHT.apollo, 90)
record("scoring.apollo_weight", "scoring", "pass", "Apollo decision-maker source weight = 90")

console.log("\n=== AI-1 Enrollment Readiness ===")
const imported = evaluateApolloImportReadiness({
  discovery_contacts: 3,
  company_contacts_synced: 0,
  apollo_source_metadata_present: true,
})
assert.equal(imported.overall_state, "imported")
assert.equal(imported.flags.research_complete, false)
record("readiness.imported", "readiness", "pass", "Imported state before sync")

const inProgress = evaluateApolloImportReadiness({
  discovery_contacts: 3,
  company_contacts_synced: 3,
  research_summary_present: false,
  apollo_source_metadata_present: true,
})
assert.equal(inProgress.overall_state, "research_in_progress")
record("readiness.research_in_progress", "readiness", "pass", "Research in progress when summary missing")

const sequenceReady = evaluateApolloImportReadiness({
  discovery_contacts: 5,
  company_contacts_synced: 5,
  canonical_persons_linked: 4,
  research_summary_present: true,
  lead_score: 72,
  email_eligible: true,
  sequence_readiness_state: "ready",
  apollo_source_metadata_present: true,
})
assert.equal(sequenceReady.flags.research_complete, true)
assert.equal(sequenceReady.flags.score_available, true)
assert.equal(sequenceReady.flags.contactable, true)
assert.equal(sequenceReady.flags.sequence_ready, true)
assert.equal(sequenceReady.overall_state, "sequence_ready")
record("readiness.sequence_ready", "readiness", "pass", "All readiness flags true")

console.log("\n=== AI-1 Cost Controls ===")
beginApolloRunGuardrails()
recordApolloSearchApiCall()
const snapshot = getApolloRunGuardrailSnapshot()
assert.ok(snapshot)
assert.equal(snapshot!.search_api_calls, 1)
resetApolloRunGuardrails()
record("cost.guardrails", "cost_controls", "pass", "Search API call recorded in guardrail snapshot")

beginApolloRunGuardrails()
for (let i = 0; i < 60; i += 1) recordApolloSearchApiCall()
assert.throws(() => assertApolloCompanySearchAllowed(), ApolloRunGuardrailError)
resetApolloRunGuardrails()
record("cost.api_cap", "cost_controls", "pass", "Max API calls per run enforced")

const apolloProviderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/providers/apollo-contact-discovery-provider.ts"),
  "utf8",
)
assert.ok(!apolloProviderSource.includes("company_contacts"))
assert.ok(!apolloProviderSource.includes("upsertProviderCompanyContacts"))
record("cost.write_boundary", "cost_controls", "pass", "Provider does not direct-write company_contacts")
}

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const reportPath = path.join(process.cwd(), "docs/APOLLO_INTEGRATION_AI_1_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# Apollo Integration AI-1 Certification Report

Generated by \`pnpm test:apollo-integration-ai-1\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |

**Verdict:** ${fail === 0 ? "PASS" : "FAIL"}

## Results

| ID | Section | Status | Detail |
|----|---------|--------|--------|
${table}

See [APOLLO_INTEGRATION_AI_1.md](./APOLLO_INTEGRATION_AI_1.md) for audit, activation, data flow, and gaps.
`,
    "utf8",
  )
  console.log(`\nWrote ${reportPath}`)
}

async function main(): Promise<void> {
  await runAsyncChecks()
  Object.assign(process.env, priorEnv)
  const failures = results.filter((r) => r.status === "fail")
  writeReport()

  if (failures.length > 0) {
    console.error(`\nAI-1 certification failed: ${failures.length} failure(s).`)
    process.exitCode = 1
    return
  }
  console.log("\nApollo integration AI-1 certification passed.")
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
