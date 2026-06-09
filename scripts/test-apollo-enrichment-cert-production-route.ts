/**
 * Apollo EN-2 enrichment cert production route certification — no live Apollo HTTP in CI.
 * Run: pnpm test:apollo-enrichment-cert-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM,
  APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER,
  assertApolloEnrichmentCertProductionExecuteAllowed,
  assertApolloEnrichmentCertProductionResponseHasNoSecrets,
  buildApolloEnrichmentCertProductionReadinessPayload,
  redactApolloEnrichmentCertProductionSecrets,
  validateApolloEnrichmentCertConfirmation,
} from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER,
  type ApolloEnrichmentCertEvidence,
} from "../lib/growth/apollo/apollo-enrichment-cert-evidence-types"
import {
  APOLLO_ENRICHMENT_CERT_EVIDENCE_BUNDLE_QA_MARKER,
  buildApolloEnrichmentCertEvidenceBundle,
} from "../lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"

export const APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_CERT_QA_MARKER =
  "apollo-enrichment-cert-production-route-cert-en-2-v1" as const

type CertResult = { id: string; status: "pass" | "fail"; detail: string }
const results: CertResult[] = []

function record(id: string, status: CertResult["status"], detail: string): void {
  results.push({ id, status, detail })
  console.log(`${status === "pass" ? "✓" : "✗"} ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-enrichment-cert-evidence-bundle.ts",
  "lib/growth/apollo/apollo-enrichment-cert-production-route-gates.ts",
  "lib/growth/apollo/apollo-enrichment-cert-production-route.ts",
  "app/api/platform/growth/apollo-enrichment-cert/readiness/route.ts",
  "app/api/platform/growth/apollo-enrichment-cert/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "pass", "Present")
}

assert.equal(
  APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER,
  "apollo-enrichment-cert-production-route-en-2-v1",
)
assert.equal(APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM, "RUN_APOLLO_ENRICHMENT_CERT")

console.log("\n=== Route protection (static) ===")
const readinessRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-enrichment-cert/readiness/route.ts"),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-enrichment-cert/execute/route.ts"),
  "utf8",
)
assert.match(readinessRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /validateApolloEnrichmentCertConfirmation/)
assert.match(executeRoute, /executeApolloEnrichmentCertInProduction/)
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
assert.doesNotMatch(readinessRoute, /SUPABASE_SERVICE_ROLE_KEY/)
record("route.platform_admin", "pass", "Enrichment cert routes require platform admin access")

console.log("\n=== Confirmation gate ===")
const noBody = validateApolloEnrichmentCertConfirmation(null)
assert.equal(noBody.ok, false)
record("confirm.body_required", "pass", "Missing body rejected")

const wrongConfirm = validateApolloEnrichmentCertConfirmation({ confirm: "yes" })
assert.equal(wrongConfirm.ok, false)
record("confirm.exact_token", "pass", "Wrong confirm token rejected")

const okConfirm = validateApolloEnrichmentCertConfirmation({
  confirm: APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM,
})
assert.equal(okConfirm.ok, true)
record("confirm.accepts_token", "pass", "RUN_APOLLO_ENRICHMENT_CERT accepted")

console.log("\n=== Execute gates (mock / missing env) ===")
const emptyEnv = {} as NodeJS.ProcessEnv
const blocked = assertApolloEnrichmentCertProductionExecuteAllowed(emptyEnv)
assert.equal(blocked.ok, false)
assert.ok(blocked.blockers.length >= 5)
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_EN_1_CERT_ENABLED")))
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_ENRICH_EMAILS")))
record("gates.empty_env", "pass", "Empty env blocked with multiple gate failures")

const mockEnv = {
  GROWTH_APOLLO_EN_1_CERT_ENABLED: "true",
  GROWTH_APOLLO_EN_1_CERT_ACK: "1",
  GROWTH_APOLLO_ENRICH_EMAILS: "true",
  GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "true",
  GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID: "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const mockAllowed = assertApolloEnrichmentCertProductionExecuteAllowed(mockEnv)
assert.equal(mockAllowed.ok, true)
record("gates.mock_allowed_with_key", "pass", "Mock mode allowed when other gates satisfied")

const killSwitchEnv = {
  GROWTH_APOLLO_EN_1_CERT_ENABLED: "true",
  GROWTH_APOLLO_EN_1_CERT_ACK: "1",
  GROWTH_APOLLO_ENRICH_EMAILS: "true",
  GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "false",
  GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID: "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
  GROWTH_DISCOVERY_DISABLE_APOLLO: "1",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const killBlocked = assertApolloEnrichmentCertProductionExecuteAllowed(killSwitchEnv)
assert.equal(killBlocked.ok, false)
assert.ok(killBlocked.blockers.some((b) => b.includes("kill switch")))
record("gates.kill_switch", "pass", "Kill switch blocks execute")

console.log("\n=== Readiness payload (no secrets) ===")
const readiness = buildApolloEnrichmentCertProductionReadinessPayload({
  candidate_count: 10,
  candidates_with_apollo_person_id: 10,
  env: emptyEnv,
})
assert.equal(readiness.qa_marker, APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER)
assert.equal(readiness.api_configured, false)
assert.equal(readiness.candidate_count, 10)
assert.equal(readiness.candidates_with_apollo_person_id, 10)
const readinessJson = JSON.stringify(readiness)
assert.ok(!readinessJson.includes("sk-test"))
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readinessJson)
record("readiness.no_secrets", "pass", "Readiness payload omits secret values")

console.log("\n=== Evidence bundle ===")
const sampleEvidence: ApolloEnrichmentCertEvidence = {
  qa_marker: APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER,
  cert_at: "2026-06-09T12:00:00.000Z",
  mock: false,
  company: {
    company_candidate_id: "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
    company_name: "Henry Schein",
    domain: "henryschein.com",
    canonical_company_id: "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
  },
  gates: {
    enrich_emails: true,
    enrich_emails_ack: true,
    en_1_cert_enabled: true,
    en_1_cert_ack: true,
    max_people: 10,
  },
  recommended_path: {
    path_id: "apollo_bulk_match",
    name: "Apollo people/bulk_match",
    credit_cost: "~1 credit per 10 IDs",
    env_gates: [],
  },
  enrichment: {
    candidates_eligible: 10,
    candidates_with_apollo_person_id: 10,
    bulk_match_batches: 1,
    credits_consumed: 1,
    candidates_updated: 7,
  },
  channels: {
    emails_found: 5,
    phones_found: 2,
    linkedin_found: 6,
    verified_emails: 4,
    before: { email: 0, phone: 0, linkedin: 0 },
    after: { email: 5, phone: 2, linkedin: 6 },
  },
  promotion: {
    company_contacts_synced: 7,
    company_contacts_promoted: 7,
  },
  readiness: {
    sequence_ready: 5,
    contactable: 7,
  },
  runtime: {
    duration_ms: 4200,
    api_calls: 1,
    errors: [],
  },
  certification: {
    go_no_go: "go",
    reasons: ["Channels obtained after bulk_match"],
  },
}

const bundle = buildApolloEnrichmentCertEvidenceBundle({
  evidence: sampleEvidence,
  ok: true,
  canonical_person_matches: 5,
  canonical_company_matches: 1,
})
assert.equal(bundle.qa_marker, APOLLO_ENRICHMENT_CERT_EVIDENCE_BUNDLE_QA_MARKER)
assert.equal(bundle.enrichment.candidates_processed, 10)
assert.equal(bundle.enrichment.emails_found, 5)
assert.equal(bundle.promotion.canonical_person_matches, 5)
assert.equal(bundle.promotion.canonical_company_matches, 1)
assert.equal(bundle.cost.cost_per_contactable, 0.143)
assert.equal(bundle.cost.cost_per_sequence_ready, 0.2)
assert.equal(bundle.verdict, "go")
const bundleJson = JSON.stringify(bundle)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(bundleJson)
record("bundle.shape", "pass", "Evidence bundle includes enrichment, promotion, readiness, cost, verdict")

console.log("\n=== Redaction helper ===")
const redacted = redactApolloEnrichmentCertProductionSecrets({
  APOLLO_API_KEY: "sk-live-secret",
  nested: { GROWTH_APOLLO_API_KEY: "sk-other" },
  safe: "ok",
})
assert.equal((redacted as Record<string, unknown>).APOLLO_API_KEY, "[REDACTED]")
record("redaction.keys", "pass", "Known secret keys redacted")

console.log("\n=== Execute route does not log API key ===")
assert.doesNotMatch(executeRoute, /logGrowthEngine\([^)]*env/)
record("execute.no_secret_logging", "pass", "Execute route avoids env secret logging")

const pass = results.filter((r) => r.status === "pass").length
const fail = results.filter((r) => r.status === "fail").length
console.log(`\nCertification: ${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
