/**
 * Apollo live pilot production route certification — no live Apollo HTTP in CI.
 * Run: pnpm test:apollo-live-pilot-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM,
  APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER,
  APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_CONFIRM,
  assertApolloLivePilotProductionExecuteAllowed,
  assertApolloLivePilotProductionResponseHasNoSecrets,
  redactApolloLivePilotProductionSecrets,
  validateApolloLivePilotProductionExecuteConfirmation,
  validateApolloLivePilotTestCompanyPrepareConfirmation,
  buildApolloLivePilotProductionReadinessPayload,
} from "../lib/growth/apollo/apollo-live-pilot-production-route-gates"
import {
  describeApolloLivePilotThrownError,
  formatApolloLivePilotErrorForEvidence,
  formatApolloLivePilotFailureForEvidence,
  redactApolloLivePilotErrorMessage,
} from "../lib/growth/apollo/apollo-live-pilot-error-reporting"
import {
  parseApolloProviderMessageLine,
  resolveApolloContactsFromDiscoverySnapshot,
  resolveApolloProviderOutcomeFromDiscoverySnapshot,
} from "../lib/growth/apollo/apollo-live-pilot-discovery-result"
import { GROWTH_CONTACT_DISCOVERY_QA_MARKER } from "../lib/growth/contact-discovery/contact-discovery-types"
import { buildApolloLivePilotEvidenceBundle } from "../lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import { buildApolloLivePilotMockEvidence } from "../lib/growth/apollo/apollo-live-pilot-fixture"
import { validateApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  buildApolloLivePilotProviderDiscoveryError,
  buildApolloLivePilotProviderEvidence,
  classifyApolloLivePilotProviderEvidence,
  isLikelyNonPersonApolloRow,
} from "../lib/growth/apollo/apollo-live-pilot-provider-evidence"
import { evaluateApolloContactAcceptance, mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"

export const APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_CERT_QA_MARKER =
  "apollo-live-pilot-production-route-cert-v1" as const

type CertResult = { id: string; status: "pass" | "fail"; detail: string }
const results: CertResult[] = []

function record(id: string, status: CertResult["status"], detail: string): void {
  results.push({ id, status, detail })
  console.log(`${status === "pass" ? "✓" : "✗"} ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-live-pilot-discovery-result.ts",
  "lib/growth/apollo/apollo-live-pilot-contact-discovery.ts",
  "lib/growth/apollo/apollo-live-pilot-error-reporting.ts",
  "lib/growth/apollo/apollo-live-pilot-provider-evidence.ts",
  "lib/growth/apollo/apollo-live-pilot-production-route-gates.ts",
  "lib/growth/apollo/apollo-live-pilot-production-route.ts",
  "lib/growth/apollo/apollo-live-pilot-test-company-prepare-route.ts",
  "app/api/platform/growth/apollo-live-pilot/readiness/route.ts",
  "app/api/platform/growth/apollo-live-pilot/execute/route.ts",
  "app/api/platform/growth/apollo-live-pilot/test-company/prepare/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "pass", "Present")
}

assert.equal(APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER, "apollo-live-pilot-production-route-v1")
assert.equal(APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM, "RUN_APOLLO_LIVE_PILOT")
assert.equal(APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_CONFIRM, "PREPARE_APOLLO_TEST_COMPANY")

console.log("\n=== Route protection (static) ===")
const readinessRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-live-pilot/readiness/route.ts"),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-live-pilot/execute/route.ts"),
  "utf8",
)
const prepareRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-live-pilot/test-company/prepare/route.ts"),
  "utf8",
)
const prepareOrchestration = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-live-pilot-test-company-prepare-route.ts"),
  "utf8",
)
assert.match(readinessRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(prepareRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /validateApolloLivePilotProductionExecuteConfirmation/)
assert.match(executeRoute, /executeApolloLivePilotInProduction/)
assert.match(prepareRoute, /validateApolloLivePilotTestCompanyPrepareConfirmation/)
assert.match(prepareRoute, /prepareApolloLivePilotTestCompanyInProduction/)
assert.doesNotMatch(prepareRoute, /APOLLO_API_KEY/)
assert.doesNotMatch(prepareRoute, /SUPABASE_SERVICE_ROLE_KEY/)
assert.doesNotMatch(prepareOrchestration, /apollo-client|searchApolloPeople/)
assert.match(prepareOrchestration, /seedApolloLivePilotTestCompany/)
assert.match(prepareOrchestration, /resolveApolloLivePilotTestCompany/)
record("route.platform_admin", "pass", "Live pilot routes require platform admin access")

console.log("\n=== Confirmation gate ===")
const noBody = validateApolloLivePilotProductionExecuteConfirmation(null)
assert.equal(noBody.ok, false)
record("confirm.body_required", "pass", "Missing body rejected")

const wrongConfirm = validateApolloLivePilotProductionExecuteConfirmation({ confirm: "yes" })
assert.equal(wrongConfirm.ok, false)
record("confirm.exact_token", "pass", "Wrong confirm token rejected")

const okConfirm = validateApolloLivePilotProductionExecuteConfirmation({
  confirm: APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM,
})
assert.equal(okConfirm.ok, true)
record("confirm.accepts_token", "pass", "RUN_APOLLO_LIVE_PILOT accepted")

console.log("\n=== Test company prepare confirmation ===")
const prepareNoBody = validateApolloLivePilotTestCompanyPrepareConfirmation(null)
assert.equal(prepareNoBody.ok, false)
record("prepare_confirm.body_required", "pass", "Missing body rejected")

const prepareWrongConfirm = validateApolloLivePilotTestCompanyPrepareConfirmation({
  confirm: "yes",
  profile: "henry_schein",
})
assert.equal(prepareWrongConfirm.ok, false)
record("prepare_confirm.exact_token", "pass", "Wrong confirm token rejected")

const prepareMissingProfile = validateApolloLivePilotTestCompanyPrepareConfirmation({
  confirm: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_CONFIRM,
})
assert.equal(prepareMissingProfile.ok, false)
record("prepare_confirm.profile_required", "pass", "Profile required")

const prepareUnknownProfile = validateApolloLivePilotTestCompanyPrepareConfirmation({
  confirm: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_CONFIRM,
  profile: "unknown_co",
})
assert.equal(prepareUnknownProfile.ok, false)
record("prepare_confirm.known_profile", "pass", "Unknown profile rejected")

const prepareOk = validateApolloLivePilotTestCompanyPrepareConfirmation({
  confirm: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_CONFIRM,
  profile: "henry_schein",
})
assert.equal(prepareOk.ok, true)
assert.equal(prepareOk.profile, "henry_schein")
record("prepare_confirm.accepts_henry_schein", "pass", "PREPARE_APOLLO_TEST_COMPANY + henry_schein accepted")

const prepareResponseSample = redactApolloLivePilotProductionSecrets({
  ok: true,
  created: true,
  company_candidate_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  company_name: "Henry Schein",
  domain: "henryschein.com",
  env_hint: "GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.secret",
})
assert.equal(
  (prepareResponseSample as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY,
  "[REDACTED]",
)
const prepareJson = JSON.stringify(prepareResponseSample)
assertApolloLivePilotProductionResponseHasNoSecrets(prepareJson)
record("prepare_confirm.no_secrets", "pass", "Prepare response redacts secrets")

console.log("\n=== Execute gates (mock / missing env) ===")
const emptyEnv = {} as NodeJS.ProcessEnv
const blocked = assertApolloLivePilotProductionExecuteAllowed(emptyEnv)
assert.equal(blocked.ok, false)
assert.ok(blocked.blockers.length >= 5)
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED")))
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID")))
record("gates.empty_env", "pass", "Empty env blocked with multiple gate failures")

const mockEnv = {
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "true",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
  GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED: "true",
  GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const mockBlocked = assertApolloLivePilotProductionExecuteAllowed(mockEnv)
assert.equal(mockBlocked.ok, false)
assert.ok(mockBlocked.blockers.some((b) => b.includes("GROWTH_APOLLO_USE_MOCK")))
record("gates.mock_refused", "pass", "Mock mode refused even with other gates set")

const killSwitchEnv = {
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "false",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
  GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED: "true",
  GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
  GROWTH_DISCOVERY_DISABLE_APOLLO: "1",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const killBlocked = assertApolloLivePilotProductionExecuteAllowed(killSwitchEnv)
assert.equal(killBlocked.ok, false)
assert.ok(killBlocked.blockers.some((b) => b.includes("kill switch")))
record("gates.kill_switch", "pass", "Kill switch blocks execute")

console.log("\n=== Readiness payload (no secrets) ===")
const readiness = buildApolloLivePilotProductionReadinessPayload(emptyEnv)
assert.equal(readiness.qa_marker, APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER)
assert.equal(readiness.readiness.api_key.configured, false)
assert.equal(readiness.safety.outreach_triggered_by_pilot, false)
const readinessJson = JSON.stringify(readiness)
assert.ok(!readinessJson.includes("sk-test"))
assertApolloLivePilotProductionResponseHasNoSecrets(readinessJson)
record("readiness.no_secrets", "pass", "Readiness payload omits secret values")

console.log("\n=== Redaction helper ===")
const redacted = redactApolloLivePilotProductionSecrets({
  APOLLO_API_KEY: "sk-live-secret",
  nested: { GROWTH_APOLLO_API_KEY: "sk-other" },
  safe: "ok",
})
assert.equal((redacted as Record<string, unknown>).APOLLO_API_KEY, "[REDACTED]")
assert.equal(
  ((redacted as Record<string, unknown>).nested as Record<string, unknown>).GROWTH_APOLLO_API_KEY,
  "[REDACTED]",
)
record("redaction.keys", "pass", "Known secret keys redacted")

console.log("\n=== Execute route does not log API key ===")
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
assert.doesNotMatch(executeRoute, /logGrowthEngine\([^)]*env/)
record("execute.no_secret_logging", "pass", "Execute route avoids APOLLO_API_KEY in source")

console.log("\n=== Structured pilot error reporting ===")
const runnerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-live-pilot-runner.ts"),
  "utf8",
)
const productionRouteSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-live-pilot-production-route.ts"),
  "utf8",
)
assert.match(runnerSource, /logApolloLivePilotError\("runContactDiscoveryForCompany"/)
assert.match(runnerSource, /logApolloLivePilotError\("syncContactCandidatesToCompanyContacts"/)
assert.match(runnerSource, /collectApolloDiscoveryErrors/)
assert.match(runnerSource, /buildApolloLivePilotProviderEvidence/)
assert.match(runnerSource, /logApolloLivePilotProviderEvidence/)
assert.match(productionRouteSource, /evidence_bundle/)
assert.match(productionRouteSource, /pilot\.evidence/)
record("errors.runner_hooks", "pass", "Runner logs structured errors for discovery and sync")

const secretErr = new Error("Apollo failed APOLLO_API_KEY=sk-live-secret-value")
const described = describeApolloLivePilotThrownError(secretErr)
assert.equal(described.error_name, "Error")
assert.ok(!described.error_message.includes("sk-live-secret-value"))
assert.ok(described.error_message.includes("[REDACTED]"))
assert.ok(!JSON.stringify(described).includes("sk-live-secret-value"))
record("errors.redaction", "pass", "Thrown error descriptions redact secrets")

const evidenceError = formatApolloLivePilotFailureForEvidence(
  "contact_discovery_apollo_skipped",
  "ApolloSkipped",
  "apollo not configured",
)
assert.match(evidenceError, /contact_discovery_apollo_skipped/)
assert.match(evidenceError, /ApolloSkipped/)

const failedEvidence = buildApolloLivePilotMockEvidence({
  mock: false,
  runtime: { duration_ms: 100, api_calls: 0, credits_consumed: 0, errors: [evidenceError] },
  discovery: {
    raw_contacts_returned: 0,
    contacts_mapped: 0,
    contacts_skipped: 0,
    contacts_rejected: 0,
    candidates_stored: 0,
    company_contacts_synced: 0,
  },
})
const failedBundle = buildApolloLivePilotEvidenceBundle({
  evidence: failedEvidence,
  validation: validateApolloLivePilotEvidence(failedEvidence),
  certification: null,
  ok: false,
})
assert.equal(failedBundle.ok, false)
assert.ok(failedBundle.errors.length > 0)
assert.match(failedBundle.errors[0], /ApolloSkipped/)
const failedBundleJson = JSON.stringify(failedBundle)
assertApolloLivePilotProductionResponseHasNoSecrets(failedBundleJson)
assert.ok(!failedBundleJson.includes("sk-live"))
record("errors.failed_bundle", "pass", "Failed execution bundle exposes non-secret error details")

assert.match(
  formatApolloLivePilotErrorForEvidence("runContactDiscoveryForCompany", secretErr),
  /runContactDiscoveryForCompany/,
)
assert.ok(!redactApolloLivePilotErrorMessage("token APOLLO_API_KEY=abc123").includes("abc123"))
record("errors.evidence_format", "pass", "Evidence errors include phase and redacted message")

console.log("\n=== Contact discovery return shape ===")
const discoverySnapshotBase = {
  qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
  schema_ready: true,
  company_candidate_id: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
  run: null,
  contacts: [],
  buying_committee: null,
  provider_messages: [],
  provider_outcomes: [],
  persistence_error: null,
  privacy_note: "test",
}

const fromProviderOutcomes = resolveApolloProviderOutcomeFromDiscoverySnapshot({
  ...discoverySnapshotBase,
  provider_outcomes: [
    {
      provider: "apollo",
      contacts_returned: 2,
      contacts_persisted: 2,
      status: "success",
      message: null,
      provider_error: null,
    },
  ],
})
assert.equal(fromProviderOutcomes?.source, "provider_outcomes")
assert.equal(fromProviderOutcomes?.status, "success")

const fromRunMetadata = resolveApolloProviderOutcomeFromDiscoverySnapshot({
  ...discoverySnapshotBase,
  run: {
    id: "run-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    company_candidate_id: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
    created_by: null,
    provider_names: ["apollo"],
    status: "completed",
    candidate_count: 0,
    error_message: null,
    metadata: {
      provider_outcomes: [
        {
          provider: "apollo",
          contacts_returned: 0,
          contacts_persisted: 0,
          status: "skipped",
          message: "apollo not configured.",
          provider_error: null,
        },
      ],
    },
  },
})
assert.equal(fromRunMetadata?.source, "run_metadata")
assert.equal(fromRunMetadata?.status, "skipped")

const parsedMessage = parseApolloProviderMessageLine("apollo: failed — HTTP 403 — check platform access.")
assert.equal(parsedMessage?.status, "failed")
assert.match(parsedMessage?.provider_error ?? "", /403/)

const fromProviderMessages = resolveApolloProviderOutcomeFromDiscoverySnapshot({
  ...discoverySnapshotBase,
  provider_messages: ["apollo: skipped — Apollo contact discovery not enabled."],
})
assert.equal(fromProviderMessages?.source, "provider_messages")
assert.equal(fromProviderMessages?.status, "skipped")

const apolloContacts = resolveApolloContactsFromDiscoverySnapshot({
  ...discoverySnapshotBase,
  contacts: [
    {
      id: "c1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      company_candidate_id: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
      provider_name: "apollo",
      provider_type: "future_apollo",
      full_name: "Jane Doe",
      first_name: "Jane",
      last_name: "Doe",
      job_title: "CEO",
      department: null,
      seniority: null,
      linkedin_url: null,
      email: null,
      phone: null,
      verification_state: "unverified",
      confidence: 80,
      source_attribution: [],
      evidence: [],
      dedupe_hash: "abc",
      metadata: {},
    },
  ],
})
assert.equal(apolloContacts.length, 1)

assert.match(runnerSource, /runApolloLivePilotContactDiscovery/)
record("discovery.return_shape", "pass", "Apollo outcome resolves from outcomes, metadata, and messages")

console.log("\n=== Apollo provider evidence classification ===")
const titleOnlyRejection = mapApolloPeopleToContactDiscoveryRaw({
  people: [
    {
      id: "p-title",
      first_name: "Alex",
      last_name: "Intern",
      title: "Marketing Intern",
      email: "alex@example.com",
      email_status: "verified",
      organization: { primary_domain: "precisionbio.com" },
    },
  ],
  company_name: "Precision Biomedical Services",
  domain: "precisionbio.com",
  mock: false,
})
assert.equal(titleOnlyRejection.apollo_people_returned, 1)
assert.equal(titleOnlyRejection.contacts.length, 0)
assert.ok(titleOnlyRejection.rejected_sample)
assert.equal(titleOnlyRejection.rejected_sample?.raw_first_name_present, true)
assert.equal(titleOnlyRejection.rejected_sample?.raw_last_name_present, true)
assert.equal(titleOnlyRejection.rejected_sample?.mapped_full_name_present, true)
assert.equal(titleOnlyRejection.rejected_sample?.email_present, true)
assert.equal(titleOnlyRejection.rejected_sample?.rejection_reason, "irrelevant_title")
assert.ok(!JSON.stringify(titleOnlyRejection.rejected_sample).includes("alex@example.com"))
record("provider.mapper_rejects_without_pii", "pass", "Rejected sample is redacted")

const validNameMapped = mapApolloPeopleToContactDiscoveryRaw({
  people: [
    {
      id: "p-valid",
      first_name: "Jane",
      last_name: "Smith",
      title: "Chief Executive Officer",
      email: "jane@example.com",
      email_status: "verified",
      linkedin_url: "https://www.linkedin.com/in/janesmith",
    },
  ],
  company_name: "Precision Biomedical Services",
  domain: "precisionbio.com",
  mock: false,
})
assert.equal(validNameMapped.contacts.length, 1)
assert.equal(validNameMapped.diagnostics.skip_reasons.name_not_plausible ?? 0, 0)
record("provider.valid_first_last_passes_name_plausibility", "pass", "first_name + last_name passes plausibility")

const companyRowRejected = mapApolloPeopleToContactDiscoveryRaw({
  people: [
    {
      id: "p-company-row",
      name: "Director of Operations",
      title: "Operations",
    },
  ],
  company_name: "Precision Biomedical Services",
  domain: "precisionbio.com",
  mock: false,
})
assert.equal(companyRowRejected.contacts.length, 0)
assert.equal(companyRowRejected.diagnostics.skip_reasons.name_not_plausible, 1)
assert.equal(companyRowRejected.rejected_sample?.raw_first_name_present, false)
assert.equal(companyRowRejected.rejected_sample?.raw_last_name_present, false)
assert.equal(companyRowRejected.rejected_sample?.raw_name_present, true)
assert.equal(companyRowRejected.rejected_sample?.rejection_reason, "name_not_plausible")
assert.ok(
  isLikelyNonPersonApolloRow(
    companyRowRejected.rejected_sample,
    companyRowRejected.diagnostics.skip_reasons,
  ),
)
record("provider.company_row_name_not_plausible", "pass", "Company/account row rejects with name_not_plausible diagnostics")

const rejectedByMappingEvidence = buildApolloLivePilotProviderEvidence({
  provider_result: {
    provider_name: "apollo",
    provider_type: "future_apollo",
    status: "success",
    message: "Apollo returned 1 people (1 total matches)",
    contacts: [],
    metadata: {
      apollo_people_returned: 1,
      apollo_total_matches: 1,
      apollo_people_mapped: 0,
      apollo_people_rejected: 1,
      rejection_reasons: { identity_individual: 1 },
      title_bucket_rejections: { executive: 1 },
      missing_email_count: 0,
      missing_phone_count: 1,
      apollo_rejected_sample: {
        raw_first_name_present: true,
        raw_last_name_present: true,
        raw_name_present: false,
        mapped_full_name_present: true,
        title: "VP Sales",
        seniority: "vp",
        organization_domain: "precisionbio.com",
        email_present: true,
        phone_present: false,
        rejection_reason: "identity_individual",
      },
    },
  },
  candidates_stored: 0,
  company_contacts_synced: 0,
  canonical_sync_rejected: 0,
})
assert.equal(rejectedByMappingEvidence.classification, "apollo_results_rejected_by_mapping")
assert.equal(rejectedByMappingEvidence.apollo_people_returned, 1)
assert.equal(rejectedByMappingEvidence.apollo_people_mapped, 0)
const mappingError = buildApolloLivePilotProviderDiscoveryError(rejectedByMappingEvidence)
assert.ok(mappingError)
assert.match(mappingError ?? "", /ApolloResultsRejectedByMapping/)
assert.match(mappingError ?? "", /contact_discovery_apollo_results_rejected_by_mapping/)
assert.doesNotMatch(mappingError ?? "", /ApolloZeroResults/)
record("provider.returned_gt_zero_mapped_zero", "pass", "Returned>0 mapped=0 uses mapping rejection, not zero_results")

const titleRejectedEvidence = buildApolloLivePilotProviderEvidence({
  provider_result: {
    provider_name: "apollo",
    provider_type: "future_apollo",
    status: "success",
    message: "Apollo returned 1 people (1 total matches)",
    contacts: [],
    metadata: {
      apollo_people_returned: 1,
      apollo_total_matches: 1,
      apollo_people_mapped: 0,
      apollo_people_rejected: 1,
      rejection_reasons: titleOnlyRejection.diagnostics.skip_reasons,
      title_bucket_rejections: titleOnlyRejection.title_bucket_rejections,
      apollo_rejected_sample: titleOnlyRejection.rejected_sample,
    },
  },
  candidates_stored: 0,
  company_contacts_synced: 0,
  canonical_sync_rejected: 0,
})
assert.equal(
  classifyApolloLivePilotProviderEvidence(titleRejectedEvidence),
  "apollo_results_rejected_by_icp_title",
)
const titleError = buildApolloLivePilotProviderDiscoveryError(titleRejectedEvidence)
assert.match(titleError ?? "", /ApolloResultsRejectedByIcpTitle/)
record("provider.icp_title_rejection", "pass", "Title/ICP rejections classified separately")

const zeroPeopleEvidence = buildApolloLivePilotProviderEvidence({
  provider_result: {
    provider_name: "apollo",
    provider_type: "future_apollo",
    status: "success",
    message: "Apollo returned zero people (0 total matches)",
    contacts: [],
    metadata: {
      apollo_people_returned: 0,
      apollo_total_matches: 0,
      apollo_people_mapped: 0,
      apollo_people_rejected: 0,
    },
  },
  candidates_stored: 0,
  company_contacts_synced: 0,
  canonical_sync_rejected: 0,
})
assert.equal(zeroPeopleEvidence.classification, "apollo_zero_results")
assert.match(
  buildApolloLivePilotProviderDiscoveryError(zeroPeopleEvidence) ?? "",
  /ApolloZeroResults/,
)
record("provider.true_zero_results", "pass", "Zero Apollo people still uses zero_results classification")

const canonicalRejectedEvidence = buildApolloLivePilotProviderEvidence({
  provider_result: {
    provider_name: "apollo",
    provider_type: "future_apollo",
    status: "success",
    message: "Mapped 1 contact(s)",
    contacts: [{ full_name: "Jane Doe" } as never],
    metadata: {
      apollo_people_returned: 1,
      apollo_total_matches: 1,
      apollo_people_mapped: 1,
      apollo_people_rejected: 0,
    },
  },
  candidates_stored: 1,
  company_contacts_synced: 0,
  canonical_sync_rejected: 1,
})
assert.equal(
  classifyApolloLivePilotProviderEvidence(canonicalRejectedEvidence),
  "apollo_results_rejected_by_canonical_sync",
)
record("provider.canonical_sync_rejection", "pass", "Canonical sync rejection classified separately")

const nonPersonEvidence = buildApolloLivePilotProviderEvidence({
  provider_result: {
    provider_name: "apollo",
    provider_type: "future_apollo",
    status: "success",
    message: "Apollo returned 1 people (1 total matches)",
    contacts: [],
    metadata: {
      apollo_people_returned: 1,
      apollo_total_matches: 1,
      apollo_people_mapped: 0,
      apollo_people_rejected: 1,
      rejection_reasons: companyRowRejected.diagnostics.skip_reasons,
      title_bucket_rejections: companyRowRejected.title_bucket_rejections,
      apollo_rejected_sample: companyRowRejected.rejected_sample,
    },
  },
  candidates_stored: 0,
  company_contacts_synced: 0,
  canonical_sync_rejected: 0,
})
assert.equal(nonPersonEvidence.classification, "apollo_results_rejected_non_person_rows")
assert.match(
  buildApolloLivePilotProviderDiscoveryError(nonPersonEvidence) ?? "",
  /ApolloResultsRejectedNonPersonRows/,
)
record("provider.non_person_row_classification", "pass", "Company/account-only rows classified as non_person_rows")

const evidenceWithProvider = buildApolloLivePilotMockEvidence({
  mock: false,
  runtime: { duration_ms: 100, api_calls: 1, credits_consumed: 0, errors: [] },
  discovery: {
    raw_contacts_returned: 1,
    contacts_mapped: 0,
    contacts_skipped: 1,
    contacts_rejected: 1,
    candidates_stored: 0,
    company_contacts_synced: 0,
  },
})
evidenceWithProvider.provider = nonPersonEvidence
const bundleWithProvider = buildApolloLivePilotEvidenceBundle({
  evidence: evidenceWithProvider,
  validation: validateApolloLivePilotEvidence(evidenceWithProvider),
  certification: null,
  ok: false,
})
assert.ok(bundleWithProvider.provider)
assert.equal(bundleWithProvider.provider?.classification, "apollo_results_rejected_non_person_rows")
assert.equal(bundleWithProvider.evidence.provider?.classification, "apollo_results_rejected_non_person_rows")
record("provider.execute_bundle_includes_provider", "pass", "evidence_bundle.provider mirrors evidence.provider")

const acceptanceGate = evaluateApolloContactAcceptance(
  { first_name: "Jane", last_name: "Smith", title: "CEO", email: "jane@example.com", email_status: "verified" },
  {
    full_name: "Jane Smith",
    email: "jane@example.com",
    job_title: "CEO",
    linkedin_url: "https://www.linkedin.com/in/janesmith",
  } as never,
)
assert.equal(acceptanceGate.accepted, true)
record("provider.evaluate_acceptance_valid_name", "pass", "evaluateApolloContactAcceptance accepts valid names")

const pass = results.filter((r) => r.status === "pass").length
const fail = results.filter((r) => r.status === "fail").length
console.log(`\nCertification: ${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
