/**
 * Apollo-Primary-1 contact acquisition certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-primary-contact-acquisition-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID,
  APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM,
  APOLLO_PRIMARY_CONTACT_ACQUISITION_GATES_QA_MARKER,
  assertApolloPrimaryContactAcquisitionAllowed,
  buildApolloPrimaryContactAcquisitionReadinessPayload,
  isApolloPrimaryContactAcquisitionEnabled,
  resolveApolloPrimaryContactAcquisitionCompanyCandidateId,
  validateApolloPrimaryContactAcquisitionConfirmation,
} from "../lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import {
  APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER,
  emptyApolloPrimaryContactAcquisitionEvidence,
} from "../lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import {
  APOLLO_PRIMARY_CONTACT_DISCOVERY_PROVIDER_TYPES,
  resolveOperatorContactDiscoveryProviderTypes,
} from "../lib/growth/contact-discovery/contact-discovery-operator-providers"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-primary-contact-acquisition-evidence.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition-gates.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition-production-route.ts",
  "app/api/platform/growth/apollo-primary-contact-acquisition/readiness/route.ts",
  "app/api/platform/growth/apollo-primary-contact-acquisition/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(
  APOLLO_PRIMARY_CONTACT_ACQUISITION_GATES_QA_MARKER,
  "apollo-primary-contact-acquisition-gates-v1",
)
assert.equal(
  APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER,
  "apollo-primary-contact-acquisition-evidence-v1",
)
assert.equal(APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM, "RUN_APOLLO_PRIMARY_CONTACT_ACQUISITION")
console.log("  ✓ Apollo-Primary-1 QA markers")

const productionEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED: "true",
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK: "1",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "false",
  APOLLO_API_KEY: "sk-test-should-not-appear",
} as NodeJS.ProcessEnv

const blocked = assertApolloPrimaryContactAcquisitionAllowed({
  VERCEL_ENV: "preview",
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED: "true",
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK: "1",
} as NodeJS.ProcessEnv)
assert.equal(blocked.ok, false)
assert.ok(blocked.blockers.some((b) => b.includes("VERCEL_ENV")))
console.log("  ✓ gates — rejects non-production runtime")

const allowed = assertApolloPrimaryContactAcquisitionAllowed(productionEnv)
assert.equal(allowed.ok, true)
assert.equal(
  allowed.company_candidate_id,
  APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID,
)
console.log("  ✓ gates — production allowed with ack flags")

const confirm = validateApolloPrimaryContactAcquisitionConfirmation({
  confirm: APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM,
  companyCandidateId: APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID,
  contactLimit: 10,
})
assert.equal(confirm.ok, true)
console.log("  ✓ confirmation — accepts execute token")

const readiness = buildApolloPrimaryContactAcquisitionReadinessPayload({ env: productionEnv })
assert.equal(readiness.primary_enabled, true)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(JSON.stringify(readiness))
console.log("  ✓ readiness — no secrets in payload")

const evidence = emptyApolloPrimaryContactAcquisitionEvidence(false)
assert.equal(evidence.auto_enrollment, false)
assert.equal(evidence.outreach_sent, false)
console.log("  ✓ evidence — no auto-enrollment or outreach flags")

assert.deepEqual(APOLLO_PRIMARY_CONTACT_DISCOVERY_PROVIDER_TYPES.slice(0, 2), [
  "internal_growth",
  "future_apollo",
])
const primaryChain = resolveOperatorContactDiscoveryProviderTypes({
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED: "true",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  APOLLO_API_KEY: "key",
} as NodeJS.ProcessEnv)
assert.ok(primaryChain.includes("future_apollo"))
assert.ok(primaryChain.indexOf("future_apollo") < primaryChain.indexOf("website_public_extract"))
console.log("  ✓ provider chain — Apollo is primary external source when enabled")

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-primary-contact-acquisition.ts"),
  "utf8",
)
assert.match(orchestrator, /existing_contactable_before/)
assert.match(orchestrator, /enrichChannelLessApolloCandidates/)
assert.match(orchestrator, /promoteEnrichedApolloCandidatesToCompanyContacts/)
assert.match(orchestrator, /sequence_ready_contacts/)
assert.doesNotMatch(orchestrator, /auto_enroll|enrollLead|sequence_enroll/)
assert.doesNotMatch(orchestrator, /sendOutreach|voice_drop/)
console.log("  ✓ orchestrator — reuse, selective enrichment, promotion, readiness only")

const executeRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/apollo-primary-contact-acquisition/execute/route.ts",
  ),
  "utf8",
)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /executeApolloPrimaryContactAcquisitionInProduction/)
assert.match(executeRoute, /auto_enrollment: false/)
assert.match(executeRoute, /outreach_sent: false/)
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
console.log("  ✓ execute route — platform admin, no outreach/enrollment logging")

const productionRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-primary-contact-acquisition-production-route.ts"),
  "utf8",
)
assert.match(productionRoute, /runApolloPrimaryContactAcquisition/)
assert.match(productionRoute, /assertApolloPrimaryContactAcquisitionAllowed/)
assert.match(productionRoute, /redactApolloPrimaryContactAcquisitionSecrets/)
console.log("  ✓ production route — gated execute with secret redaction")

const prospectSearch = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-human-acquisition.ts"),
  "utf8",
)
assert.match(prospectSearch, /runApolloPrimaryContactAcquisitionForCompany/)
assert.match(prospectSearch, /no auto-enrollment/)
assert.doesNotMatch(prospectSearch, /auto_enroll|enrollLead|sequence_enroll/)
console.log("  ✓ prospect search — Apollo-Primary branch, no enrollment")

const missingAck = assertApolloPrimaryContactAcquisitionAllowed({
  VERCEL_ENV: "production",
  GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED: "true",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  APOLLO_API_KEY: "key",
} as NodeJS.ProcessEnv)
assert.equal(missingAck.ok, false)
assert.ok(missingAck.blockers.some((b) => b.includes("ACK")))
console.log("  ✓ gates — requires GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK")

assert.equal(
  resolveApolloPrimaryContactAcquisitionCompanyCandidateId({
    company_candidate_id: "custom-id",
  }),
  "custom-id",
)
assert.equal(isApolloPrimaryContactAcquisitionEnabled(productionEnv), true)
console.log("  ✓ resolver helpers")

console.log("\nAll Apollo-Primary-1 contact acquisition checks passed.")
