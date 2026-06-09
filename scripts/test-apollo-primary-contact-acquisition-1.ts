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

const ROUTE_ROOT = "app/api/platform/growth/apollo-primary-contact-acquisition"
const READINESS_ROUTE_PATH = `${ROUTE_ROOT}/readiness/route.ts`
const EXECUTE_ROUTE_PATH = `${ROUTE_ROOT}/execute/route.ts`
const EN3_READINESS_ROUTE_PATH = "app/api/platform/growth/apollo-enrichment-cert-en-3/readiness/route.ts"
const EN3_EXECUTE_ROUTE_PATH = "app/api/platform/growth/apollo-enrichment-cert-en-3/execute/route.ts"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-primary-contact-acquisition-evidence.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition-gates.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition-production-route.ts",
  READINESS_ROUTE_PATH,
  EXECUTE_ROUTE_PATH,
]

function assertRouteExportsHttpMethod(source: string, method: "GET" | "POST"): void {
  assert.match(
    source,
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b`),
    `Route must export async function ${method}`,
  )
}

function assertExactRouteDirectoryOnDisk(): void {
  const growthDir = path.join(process.cwd(), "app/api/platform/growth")
  const entries = fs.readdirSync(growthDir)
  assert.ok(
    entries.includes("apollo-primary-contact-acquisition"),
    "Expected directory app/api/platform/growth/apollo-primary-contact-acquisition",
  )
  assert.ok(
    !entries.includes("apollo-primary"),
    "Misnamed directory apollo-primary must not exist — use apollo-primary-contact-acquisition",
  )
}

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assertExactRouteDirectoryOnDisk()
console.log("  ✓ route directory — exact apollo-primary-contact-acquisition casing")

const readinessRoute = fs.readFileSync(path.join(process.cwd(), READINESS_ROUTE_PATH), "utf8")
const executeRoute = fs.readFileSync(path.join(process.cwd(), EXECUTE_ROUTE_PATH), "utf8")
const en3ReadinessRoute = fs.readFileSync(path.join(process.cwd(), EN3_READINESS_ROUTE_PATH), "utf8")
const en3ExecuteRoute = fs.readFileSync(path.join(process.cwd(), EN3_EXECUTE_ROUTE_PATH), "utf8")

assertRouteExportsHttpMethod(readinessRoute, "GET")
assertRouteExportsHttpMethod(executeRoute, "POST")
assert.doesNotMatch(readinessRoute, /export\s+async\s+function\s+POST\b/)
assert.doesNotMatch(executeRoute, /export\s+async\s+function\s+GET\b/)
console.log("  ✓ route exports — GET readiness, POST execute")

assert.match(readinessRoute, /export\s+async\s+function\s+GET\s*\(\s*request:\s*Request\s*\)/)
assert.match(readinessRoute, /auth_method:\s*"platform_admin"/)
assert.match(en3ReadinessRoute, /export\s+async\s+function\s+GET\s*\(\s*request:\s*Request\s*\)/)
console.log("  ✓ readiness route — mirrors EN-3 GET(request) + platform_admin wrapper")

assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(en3ExecuteRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /validateApolloPrimaryContactAcquisitionConfirmation/)
assert.match(executeRoute, /executeApolloPrimaryContactAcquisitionInProduction/)
console.log("  ✓ execute route — mirrors EN-3 platform-admin POST pattern")

const manifestPath = path.join(process.cwd(), ".next/app-path-routes-manifest.json")
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, string>
  const readinessManifestKey = "/api/platform/growth/apollo-primary-contact-acquisition/readiness/route"
  const executeManifestKey = "/api/platform/growth/apollo-primary-contact-acquisition/execute/route"
  assert.ok(
    Object.prototype.hasOwnProperty.call(manifest, readinessManifestKey),
    `Build manifest missing ${readinessManifestKey}`,
  )
  assert.ok(
    Object.prototype.hasOwnProperty.call(manifest, executeManifestKey),
    `Build manifest missing ${executeManifestKey}`,
  )
  console.log("  ✓ build manifest — apollo-primary-contact-acquisition routes registered")
} else {
  console.log("  · build manifest — skipped (.next/app-path-routes-manifest.json not found; run pnpm build)")
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

assert.match(executeRoute, /auto_enrollment: false/)
assert.match(executeRoute, /outreach_sent: false/)
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
console.log("  ✓ execute route — no outreach/enrollment logging, no secrets")

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
