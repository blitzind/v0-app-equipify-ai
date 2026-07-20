/**
 * GE-AIOS-REVENUE-2A — Orchestration defect remediation certification (local).
 * Run: pnpm test:ge-aios-revenue-2a-orchestration-integrity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { planDurableStageAdvance } from "../lib/growth/draft-factory/draft-factory-durable-engine"
import { emptyAttemptCounts } from "../lib/growth/draft-factory/draft-factory-durable-types"
import { mapDurableStateToPortfolioCapacityClass } from "../lib/growth/draft-factory/draft-factory-due-capacity-class"
import {
  assertGrowthPipelinePromotionIntegrity,
  evaluateGrowthPipelinePromotionIntegrity,
  GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER,
  resolveDraftFactoryAdmittedFromLeadMetadata,
} from "../lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-REVENUE-2A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${PHASE}] Orchestration integrity certification`)
console.log(`  QA marker: ${GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER}`)

assert.equal(
  resolveDraftFactoryAdmittedFromLeadMetadata({ admission_state: "accepted" }).admitted,
  true,
)
assert.equal(
  resolveDraftFactoryAdmittedFromLeadMetadata({ admission_state: "review" }).admitted,
  false,
)
assert.equal(
  resolveDraftFactoryAdmittedFromLeadMetadata({ admission_state: "rejected" }).admitted,
  false,
)
assert.equal(
  resolveDraftFactoryAdmittedFromLeadMetadata({ admission_state: "rejected" }).failed,
  true,
)
console.log("  ✓ canonical admission evidence from lead metadata")

const rejectedDm = evaluateGrowthPipelinePromotionIntegrity({
  metadata: { admission_state: "rejected" },
  boundary: "decision_maker",
})
assert.equal(rejectedDm.ok, false)
assert.equal(rejectedDm.violation, "rejected_entered_decision_maker")

const reviewPackage = evaluateGrowthPipelinePromotionIntegrity({
  metadata: { admission_state: "review" },
  boundary: "package",
})
assert.equal(reviewPackage.ok, false)
assert.equal(reviewPackage.violation, "review_entered_package")

const reviewOutbound = evaluateGrowthPipelinePromotionIntegrity({
  metadata: { admission_state: "review" },
  boundary: "outbound",
})
assert.equal(reviewOutbound.ok, false)
assert.equal(reviewOutbound.violation, "review_entered_outbound")

const acceptedPackage = evaluateGrowthPipelinePromotionIntegrity({
  metadata: { admission_state: "accepted" },
  boundary: "package",
})
assert.equal(acceptedPackage.ok, true)
console.log("  ✓ promotion integrity boundaries")

const qualificationRejected = planDurableStageAdvance({
  evidence: {
    admitted: false,
    researchCurrent: false,
    knowledgeComplete: false,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: true,
  },
  wake: "scheduled_resume",
  now: new Date().toISOString(),
  attemptCounts: emptyAttemptCounts(),
})
assert.equal(qualificationRejected.stageEvaluated, "qualification")
assert.equal(qualificationRejected.outcome, "terminal_failure")
console.log("  ✓ rejected leads terminal at qualification")

const portfolioDeferred = planDurableStageAdvance({
  evidence: {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: false,
  },
  wake: "scheduled_resume",
  now: new Date().toISOString(),
  attemptCounts: emptyAttemptCounts(),
})
assert.equal(portfolioDeferred.stageEvaluated, "portfolio")
assert.equal(portfolioDeferred.outcome, "deferred")
console.log("  ✓ portfolio stage defers until portfolioSelected wake")

assert.equal(mapDurableStateToPortfolioCapacityClass("paused"), null)
assert.equal(
  mapDurableStateToPortfolioCapacityClass("paused", { earliestIncompleteStage: "portfolio" }),
  "cheap_validation",
)
console.log("  ✓ paused portfolio-deferred leads map to cheap_validation capacity class")

const liveSource = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(liveSource, /resolveDraftFactoryAdmittedFromLeadMetadata/)
assert.doesNotMatch(liveSource, /admitted:\s*true,\s*\n\s*researchCurrent/)
console.log("  ✓ Draft Factory live evidence derives admission from metadata")

const researchSource = readSource("lib/growth/research/research-orchestrator.ts")
assert.match(
  researchSource,
  /triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence/,
)
console.log("  ✓ research completion reuses BC enqueue trigger")

const assertion = assertGrowthPipelinePromotionIntegrity({
  organizationId: "org",
  leadId: "lead",
  metadata: { admission_state: "accepted" },
  boundary: "decision_maker",
})
assert.equal(assertion.blocked, false)
console.log("  ✓ runtime assertion helper")

console.log(`\n[${PHASE}] PASS — orchestration integrity certified`)
