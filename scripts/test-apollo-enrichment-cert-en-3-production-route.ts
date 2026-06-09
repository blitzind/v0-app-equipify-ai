/**
 * Apollo EN-3 promotion cert production route certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-enrichment-cert-en-3-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID,
  APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM,
  APOLLO_ENRICHMENT_CERT_EN_3_PRODUCTION_ROUTE_QA_MARKER,
  assertApolloEnrichmentCertEn3ProductionExecuteAllowed,
  buildApolloEnrichmentCertEn3ProductionReadinessPayload,
  isApolloEnrichmentCertEn3ProductionRuntime,
  resolveApolloEnrichmentCertEn3CompanyCandidateId,
  validateApolloEnrichmentCertEn3Confirmation,
} from "../lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates.ts",
  "lib/growth/apollo/apollo-enrichment-cert-en-3-production-route.ts",
  "app/api/platform/growth/apollo-enrichment-cert-en-3/readiness/route.ts",
  "app/api/platform/growth/apollo-enrichment-cert-en-3/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(
  APOLLO_ENRICHMENT_CERT_EN_3_PRODUCTION_ROUTE_QA_MARKER,
  "apollo-enrichment-cert-en-3-production-route-v1",
)
assert.equal(APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM, "RUN_APOLLO_ENRICHMENT_CERT_EN_3")
console.log("  ✓ EN-3 production QA markers")

const nonProduction = assertApolloEnrichmentCertEn3ProductionExecuteAllowed({
  VERCEL_ENV: "preview",
  GROWTH_APOLLO_EN_3_CERT_ENABLED: "true",
  GROWTH_APOLLO_EN_3_CERT_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
} as NodeJS.ProcessEnv)
assert.equal(nonProduction.ok, false)
assert.ok(nonProduction.blockers.some((b) => b.includes("VERCEL_ENV")))
console.log("  ✓ gates — rejects non-production runtime")

const productionEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  GROWTH_APOLLO_EN_3_CERT_ENABLED: "true",
  GROWTH_APOLLO_EN_3_CERT_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
} as NodeJS.ProcessEnv
const allowed = assertApolloEnrichmentCertEn3ProductionExecuteAllowed(productionEnv)
assert.equal(allowed.ok, true)
assert.equal(
  allowed.company_candidate_id,
  APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID,
)
console.log("  ✓ gates — production EN-3 allowed without Apollo API key")

const confirm = validateApolloEnrichmentCertEn3Confirmation({
  confirm: APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM,
  companyCandidateId: APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID,
})
assert.equal(confirm.ok, true)
assert.equal(confirm.company_candidate_id, APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID)
console.log("  ✓ confirmation — accepts companyCandidateId")

const defaultConfirm = validateApolloEnrichmentCertEn3Confirmation({
  confirm: APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM,
})
assert.equal(defaultConfirm.company_candidate_id, APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID)
console.log("  ✓ confirmation — defaults Henry Schein candidate id")

const readiness = buildApolloEnrichmentCertEn3ProductionReadinessPayload({
  enriched_candidate_count: 8,
  enriched_candidates_with_email: 5,
  enriched_candidates_with_linkedin: 8,
  env: productionEnv,
})
assert.equal(readiness.apollo_credits_required, false)
assert.equal(readiness.enriched_candidate_count, 8)
const readinessJson = JSON.stringify(readiness)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readinessJson)
console.log("  ✓ readiness — no secrets, apollo_credits_required false")

const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-enrichment-cert-en-3/execute/route.ts"),
  "utf8",
)
const productionRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-enrichment-cert-en-3-production-route.ts"),
  "utf8",
)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /executeApolloEnrichmentCertEn3InProduction/)
assert.match(productionRoute, /runApolloEnrichmentCertEn3/)
assert.doesNotMatch(productionRoute, /enrichApolloPeopleWithBulkMatch/)
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
console.log("  ✓ execute route — platform admin, EN-3 only, no Apollo HTTP")

assert.equal(
  resolveApolloEnrichmentCertEn3CompanyCandidateId({
    company_candidate_id: "custom-id",
  }),
  "custom-id",
)
assert.equal(isApolloEnrichmentCertEn3ProductionRuntime({ VERCEL_ENV: "production" } as NodeJS.ProcessEnv), true)
console.log("  ✓ resolver helpers")

console.log("\nAll Apollo EN-3 production route checks passed.")
