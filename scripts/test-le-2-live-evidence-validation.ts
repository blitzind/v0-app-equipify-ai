/**
 * LE-2 live evidence validation harness — rejects fixtures/mocks.
 * Run: pnpm test:le-2-live-evidence-validation
 */
import assert from "node:assert/strict"
import { buildApolloLivePilotEvidenceBundle } from "../lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import { certifyApolloProductionRollout } from "../lib/growth/apollo/apollo-integration-ai-3-production-certification"
import { buildApolloLivePilotAi3ApprovedEvidence } from "../lib/growth/apollo/apollo-live-pilot-fixture"
import { validateApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  LE_2_LIVE_EVIDENCE_VALIDATION_QA_MARKER,
  validateLe2LiveEvidence,
} from "../lib/growth/live-execution/le-2-live-evidence-validation"

assert.equal(LE_2_LIVE_EVIDENCE_VALIDATION_QA_MARKER, "le-2-live-evidence-validation-v1")

console.log("=== LE-2 rejects empty evidence ===")
const empty = validateLe2LiveEvidence({ evidence: {} })
assert.equal(empty.final_verdict, "rejected")
assert.ok(empty.blockers.some((b) => b.includes("apollo-ai-3-pilot")))
console.log("✓ Empty evidence rejected")

console.log("\n=== LE-2 rejects bare fixture evidence (requires AI-4 bundle) ===")
const bareFixture = validateLe2LiveEvidence({
  evidence: { apollo: buildApolloLivePilotAi3ApprovedEvidence() },
})
assert.equal(bareFixture.final_verdict, "rejected")
assert.ok(bareFixture.blockers.some((b) => b.includes("AI-4 bundle")))
console.log("✓ Bare fixture rejected")

console.log("\n=== LE-2 accepts bundle shape but still needs manual evidence files ===")
const evidence = buildApolloLivePilotAi3ApprovedEvidence()
const validation = validateApolloLivePilotEvidence(evidence)
const ai3 = certifyApolloProductionRollout({ evidence })
const bundle = buildApolloLivePilotEvidenceBundle({
  evidence,
  validation,
  certification: ai3.certification,
  ok: true,
  output_path: "./evidence/apollo-ai-3-pilot.json",
})
const bundled = validateLe2LiveEvidence({
  evidence: { apollo: bundle },
  compliance_orchestration_enabled: true,
  voice_drop_vd4_live_certified: true,
})
assert.equal(bundled.final_verdict, "rejected")
assert.ok(bundled.blockers.some((b) => b.includes("email")))
console.log(`✓ Bundle without manual steps: ${bundled.final_verdict}`)

console.log("\nLE-2 validation harness passed.")
