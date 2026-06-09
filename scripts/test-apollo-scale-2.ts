/**
 * Apollo-Scale-2 live acquisition structure certification.
 * Run: pnpm test:apollo-scale-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const PRODUCTION_CERT = "scripts/certify-apollo-scale-2-production.ts"
const CERT_MODULE = "lib/growth/apollo/apollo-scale-2-live-acquisition-certification.ts"
const PRIMARY_ACQUISITION = "lib/growth/apollo/apollo-primary-contact-acquisition.ts"

const HENRY_SCHEIN_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"

for (const relativePath of [PRODUCTION_CERT, CERT_MODULE, PRIMARY_ACQUISITION]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const productionCert = fs.readFileSync(path.join(process.cwd(), PRODUCTION_CERT), "utf8")
const certModule = fs.readFileSync(path.join(process.cwd(), CERT_MODULE), "utf8")
const primaryAcquisition = fs.readFileSync(path.join(process.cwd(), PRIMARY_ACQUISITION), "utf8")

assert.match(productionCert, /certifyApolloScale2LiveAcquisition/)
assert.match(productionCert, /apollo_live_gate_blocked/)
assert.doesNotMatch(productionCert, /--audit-only/)
assert.doesNotMatch(productionCert, /certifyApolloScale1ProductionAudit/)
assert.doesNotMatch(productionCert, /confirmGrowthSequenceEnrollment/)
assert.doesNotMatch(productionCert, /runSequenceExecutionJob/)

assert.match(certModule, new RegExp(HENRY_SCHEIN_ID))
assert.match(certModule, /no_prior_apollo_acquisition/)
assert.match(certModule, /skip_apollo_search_if_existing_contactable: false/)
assert.match(certModule, /live_apollo_acquisition/)

const scale2RouteGates = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-scale-2-production-route-gates.ts"),
  "utf8",
)
assert.match(scale2RouteGates, /RUN_APOLLO_SCALE_2/)
assert.match(scale2RouteGates, /GROWTH_APOLLO_SCALE_2_ENABLED/)
console.log("  ✓ Scale-2 production route gates present")

assert.match(primaryAcquisition, /skip_apollo_search_if_existing_contactable/)
console.log("  ✓ Scale-2 excludes Henry Schein and forces live Apollo search")

console.log("\nApollo-Scale-2 structure certification passed.")
