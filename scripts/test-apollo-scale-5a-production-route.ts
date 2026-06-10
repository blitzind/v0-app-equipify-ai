/**
 * Apollo-Scale-5A production route certification — no live DB in CI.
 * Run: pnpm test:apollo-scale-5a-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_SCALE_5A_EXECUTE_CONFIRM,
  APOLLO_SCALE_5A_ROUTE_QA_MARKER,
  assertApolloScale5AExecuteAllowed,
  buildApolloScale5AReadinessPayload,
} from "../lib/growth/apollo/apollo-scale-5a-production-route-gates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-contactable-eligibility-audit.ts",
  "lib/growth/apollo/apollo-contactable-eligibility-audit-runner.ts",
  "lib/growth/apollo/apollo-scale-5a-production-route-gates.ts",
  "lib/growth/apollo/apollo-scale-5a-production-route.ts",
  "app/api/platform/growth/apollo-scale-5a/readiness/route.ts",
  "app/api/platform/growth/apollo-scale-5a/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_SCALE_5A_ROUTE_QA_MARKER, "apollo-scale-5a-contactable-eligibility-audit-route-v1")
assert.equal(APOLLO_SCALE_5A_EXECUTE_CONFIRM, "RUN_APOLLO_SCALE_5A")

const productionEnv = {
  VERCEL_ENV: "production",
  GROWTH_APOLLO_SCALE_5A_ACK: "1",
} as NodeJS.ProcessEnv
assert.equal(assertApolloScale5AExecuteAllowed(productionEnv).ok, true)

const readiness = buildApolloScale5AReadinessPayload({ env: productionEnv })
assert.equal(readiness.apollo_credits_required, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(JSON.stringify(readiness))

const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-scale-5a/execute/route.ts"),
  "utf8",
)
assert.match(executeRoute, /executeApolloScale5AInProduction/)
assert.doesNotMatch(executeRoute, /runApolloPrimaryContactAcquisition/)
assert.doesNotMatch(executeRoute, /confirmGrowthSequenceEnrollment/)

console.log("\nAll Apollo-Scale-5A production route checks passed.")
