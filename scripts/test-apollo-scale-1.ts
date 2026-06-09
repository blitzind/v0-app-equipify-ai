/**
 * Apollo-Scale-1 structure certification.
 * Run: pnpm test:apollo-scale-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const PRODUCTION_CERT = "scripts/certify-apollo-scale-1-production.ts"
const CERT_MODULE = "lib/growth/apollo/apollo-scale-1-production-certification.ts"
const PRIMARY_ACQUISITION = "lib/growth/apollo/apollo-primary-contact-acquisition.ts"
const PRIMARY_EVIDENCE = "lib/growth/apollo/apollo-primary-contact-acquisition-evidence.ts"

for (const relativePath of [PRODUCTION_CERT, CERT_MODULE, PRIMARY_ACQUISITION, PRIMARY_EVIDENCE]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const productionCert = fs.readFileSync(path.join(process.cwd(), PRODUCTION_CERT), "utf8")
const certModule = fs.readFileSync(path.join(process.cwd(), CERT_MODULE), "utf8")
const primaryAcquisition = fs.readFileSync(path.join(process.cwd(), PRIMARY_ACQUISITION), "utf8")
const primaryEvidence = fs.readFileSync(path.join(process.cwd(), PRIMARY_EVIDENCE), "utf8")

assert.match(productionCert, /certifyApolloScale1Production/)
assert.match(productionCert, /GROWTH_APOLLO_ENRICH_EMAILS_ACK/)
assert.match(productionCert, /APOLLO_SCALE_1_QA_MARKER/)
assert.doesNotMatch(productionCert, /approveSequenceExecutionJob/)
assert.doesNotMatch(productionCert, /confirmGrowthSequenceEnrollment/)
assert.doesNotMatch(productionCert, /runSequenceExecutionJob/)
assert.doesNotMatch(productionCert, /runGrowthSequenceScheduler/)

assert.match(certModule, /runApolloPrimaryContactAcquisition/)
assert.match(certModule, /buildApolloScale1ProductionCertification/)
assert.match(certModule, /resolveApolloScale1CompanySample/)
assert.match(certModule, /auto_enrollment: false/)
assert.match(certModule, /outreach_sent: false/)
assert.match(certModule, /enrollment_confirmed: false/)

assert.match(primaryAcquisition, /no outreach\/enrollment/)
assert.match(primaryEvidence, /outreach_sent: false/)
console.log("  ✓ scale cert excludes enrollment, scheduler, and outreach paths")

console.log("\nApollo-Scale-1 structure certification passed.")
