/**
 * Apollo Full Pipeline Production Certification — regression checks without live outreach.
 * Run: pnpm test:apollo-full-pipeline-production-certification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
  APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST,
  APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES,
  assertApolloFullPipelineProductionCertificationAllowed,
  buildApolloFullPipelineProductionCertificationReadinessPayload,
  validateApolloFullPipelineProductionCertificationConfirmation,
} from "../lib/growth/apollo/apollo-full-pipeline-production-route-gates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-full-pipeline-production-certification-types.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-certification.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-route-gates.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-route.ts",
  "app/api/platform/growth/apollo-full-pipeline-certification/readiness/route.ts",
  "app/api/platform/growth/apollo-full-pipeline-certification/execute/route.ts",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "sendEmail",
  "sendSms",
  "runSequenceVoiceDrop",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
  "apollo-full-pipeline-production-certification-v1",
)
assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  "apollo-full-pipeline-production-certification-v1",
)
assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
  "apollo-full-pipeline-production-certification-route-v1",
)
console.log("  ✓ full pipeline certification QA markers")

assert.deepEqual([...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN], [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
])
console.log("  ✓ attribution chain")

const confirmReject = validateApolloFullPipelineProductionCertificationConfirmation({
  confirm: "WRONG",
  companyCandidateId: "c-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloFullPipelineProductionCertificationConfirmation({
  confirm: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
  companyCandidateId: "c-1",
  enrollmentCandidateId: "e-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.company_candidate_id, "c-1")
assert.equal(confirmOk.enrollment_candidate_id, "e-1")
console.log("  ✓ execute confirmation")

const readiness = buildApolloFullPipelineProductionCertificationReadinessPayload({
  env: {
    ...process.env,
    GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK: "1",
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK: "1",
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED: "true",
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK: "1",
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK: "1",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK: "1",
    VERCEL_ENV: "production",
  },
})
assert.equal(readiness.outreach_sent, false)
assert.equal(readiness.jobs_scheduled, false)
assert.equal(readiness.draft_created, true)
assert.ok(Array.isArray(readiness.readiness_checklist))
assert.ok(readiness.readiness_checklist.length >= 8)
assert.ok(APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST.length >= 8)
assert.ok(APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES.length >= 3)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness payload + checklist")

assert.match(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  /apollo-full-pipeline-certification\/execute/,
)
assert.match(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  new RegExp(APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM),
)
console.log("  ✓ browser console snippet")

const certSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-full-pipeline-production-certification.ts"),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-full-pipeline-certification/execute/route.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(certSource, new RegExp(forbidden, "i"), `Cert must not import ${forbidden}`)
  assert.doesNotMatch(executeRoute, new RegExp(forbidden, "i"), `Execute route must not import ${forbidden}`)
}
console.log("  ✓ no live outreach side-effect imports")

assert.match(certSource, /approveApolloEnrollmentCandidate/)
assert.match(certSource, /approveApolloVoiceDropCandidate/)
assert.match(certSource, /approveApolloMultichannelSequenceCandidate/)
assert.match(certSource, /pending_approval/)
console.log("  ✓ end-to-end approval chain wired")

const gates = assertApolloFullPipelineProductionCertificationAllowed({
  GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when ACK missing")

console.log("\nApollo Full Pipeline Production Certification checks passed.")
