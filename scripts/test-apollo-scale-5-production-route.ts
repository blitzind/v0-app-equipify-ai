/**
 * Apollo-Scale-5 production route certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-scale-5-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_SCALE_5_DEFAULT_CONTACT_LIMIT,
  APOLLO_SCALE_5_EXECUTE_CONFIRM,
  APOLLO_SCALE_5_PRODUCTION_ROUTE_QA_MARKER,
  APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES,
  assertApolloScale5ProductionExecuteAllowed,
  buildApolloScale5ProductionReadinessPayload,
  computeApolloScale5CertResult,
  isApolloScale5ProductionRuntime,
  validateApolloScale5Confirmation,
} from "../lib/growth/apollo/apollo-scale-5-production-route-gates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-scale-5-production-route-gates.ts",
  "lib/growth/apollo/apollo-scale-5-production-route.ts",
  "lib/growth/apollo/apollo-scale-5-verified-email-production-certification.ts",
  "app/api/platform/growth/apollo-scale-5/readiness/route.ts",
  "app/api/platform/growth/apollo-scale-5/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_SCALE_5_PRODUCTION_ROUTE_QA_MARKER, "apollo-scale-5-production-route-v1")
assert.equal(APOLLO_SCALE_5_EXECUTE_CONFIRM, "RUN_APOLLO_SCALE_5")
assert.equal(APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES.length, 4)
console.log("  ✓ Scale-5 production QA markers")

const nonProduction = assertApolloScale5ProductionExecuteAllowed({
  VERCEL_ENV: "preview",
  GROWTH_APOLLO_SCALE_5_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
  APOLLO_API_KEY: "test-key",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_ENRICH_EMAILS: "true",
  GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
} as NodeJS.ProcessEnv)
assert.equal(nonProduction.ok, false)
assert.ok(nonProduction.blockers.some((b) => b.includes("VERCEL_ENV")))
console.log("  ✓ gates — rejects non-production runtime")

const blocked = assertApolloScale5ProductionExecuteAllowed({
  VERCEL_ENV: "production",
  GROWTH_APOLLO_SCALE_5_ACK: "0",
} as NodeJS.ProcessEnv)
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_SCALE_5_ACK")))
console.log("  ✓ gates — requires GROWTH_APOLLO_SCALE_5_ACK")

const productionEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  GROWTH_APOLLO_SCALE_5_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
  APOLLO_API_KEY: "test-key",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_ENRICH_EMAILS: "true",
  GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
} as NodeJS.ProcessEnv
const allowed = assertApolloScale5ProductionExecuteAllowed(productionEnv)
assert.equal(allowed.ok, true)
assert.equal(allowed.contact_limit, APOLLO_SCALE_5_DEFAULT_CONTACT_LIMIT)
console.log("  ✓ gates — production Scale-5 allowed with Apollo key")

const confirm = validateApolloScale5Confirmation({ confirm: APOLLO_SCALE_5_EXECUTE_CONFIRM })
assert.equal(confirm.ok, true)
assert.equal(confirm.contact_limit, APOLLO_SCALE_5_DEFAULT_CONTACT_LIMIT)
console.log("  ✓ confirmation — accepts RUN_APOLLO_SCALE_5")

const readiness = buildApolloScale5ProductionReadinessPayload({
  company_candidate_id: "mes-company-id",
  company_resolution_error: null,
  env: productionEnv,
})
assert.equal(readiness.target_company.domain, "medicalequipmentsolutions.com")
assert.equal(readiness.apollo_credits_required, true)
assert.match(readiness.browser_console_execute_snippet, /apollo-scale-5\/execute/)
const readinessJson = JSON.stringify(readiness)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readinessJson)
console.log("  ✓ readiness — target company, no secrets, browser snippet")

const passVerdict = computeApolloScale5CertResult({
  promoted_contacts: 4,
  contactable_contacts: 4,
  sequence_ready_contacts: 4,
  verified_contact_checks: APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES.map((full_name) => ({
    full_name,
    result: "PASS" as const,
    blocker: null,
  })),
})
assert.equal(passVerdict, "PASS")
console.log("  ✓ verdict — PASS when criteria and verified contacts pass")

const partialVerdict = computeApolloScale5CertResult({
  promoted_contacts: 4,
  contactable_contacts: 4,
  sequence_ready_contacts: 4,
  verified_contact_checks: [
    { full_name: "Tanya Powell", result: "PASS", blocker: null },
    { full_name: "Jonathan Branch", result: "PASS", blocker: null },
    { full_name: "Scott Alexander", result: "PASS", blocker: null },
    { full_name: "Kimberly Woolsey", result: "FAIL", blocker: "missing_canonical_person_id" },
  ],
})
assert.equal(partialVerdict, "PASS_PARTIAL")
console.log("  ✓ verdict — PASS_PARTIAL when Kimberly still blocked")

const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-scale-5/execute/route.ts"),
  "utf8",
)
const productionRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-scale-5-production-route.ts"),
  "utf8",
)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /executeApolloScale5InProduction/)
assert.match(executeRoute, /maxDuration = 300/)
assert.match(productionRoute, /certifyApolloScale5VerifiedEmailPromotion/)
assert.match(productionRoute, /resolveMedicalEquipmentSolutionsCompany/)
const certModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-scale-5-verified-email-production-certification.ts"),
  "utf8",
)
assert.match(certModule, /email_channel_evidence/)
assert.match(certModule, /email_enrichment/)
console.log("  ✓ certification — email channel evidence + enrichment metrics")
assert.doesNotMatch(executeRoute, /confirmGrowthSequenceEnrollment/)
assert.doesNotMatch(executeRoute, /runSequenceExecutionJob/)
assert.doesNotMatch(productionRoute, /APOLLO_API_KEY/)
console.log("  ✓ execute route — platform admin, acquisition only, no outreach")

assert.equal(isApolloScale5ProductionRuntime({ VERCEL_ENV: "production" } as NodeJS.ProcessEnv), true)
console.log("  ✓ runtime helpers")

console.log("\nAll Apollo-Scale-5 production route checks passed.")
