/**
 * GE-AIOS-REVENUE-2H — SV1-5 investment gate alignment certification.
 * Run: pnpm test:ge-aios-revenue-2h-sv1-5-investment-gate-alignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  isBillableDraftingAuthorized,
  planDurableStageAdvance,
  projectDurableStateFromStage,
  reconstructDraftFactoryStateFromCanonicalData,
  resolveEarliestIncompleteDurableStage,
} from "../lib/growth/draft-factory/draft-factory-durable-engine"
import { advanceDraftFactoryForLead } from "../lib/growth/draft-factory/draft-factory-durable-service"
import {
  emptyAttemptCounts,
  type AiOsDraftFactoryCanonicalEvidence,
} from "../lib/growth/draft-factory/draft-factory-durable-types"
import { clearDurableDraftFactoryStoreForTests } from "../lib/growth/draft-factory/draft-factory-durable-store"

const PHASE = "GE-AIOS-REVENUE-2H" as const
const ROOT = process.cwd()
const ORG = "org-revenue-2h"
const NOW = "2026-07-20T17:00:00.000Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function upstreamReadyEvidence(
  partial?: Partial<AiOsDraftFactoryCanonicalEvidence>,
): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: true,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: true,
    personalizationReady: true,
    draftValid: false,
    approved: false,
    rejected: false,
    ...partial,
  }
}

console.log(`[${PHASE}] SV1-5 investment gate alignment certification`)

async function main(): Promise<void> {
assert.equal(isBillableDraftingAuthorized({ investmentState: "increase_investment", spendAuthorized: true }), true)
assert.equal(isBillableDraftingAuthorized({ investmentState: "increase_investment", spendAuthorized: false }), false)
assert.equal(isBillableDraftingAuthorized({ investmentState: "maintain_investment", spendAuthorized: true }), false)
assert.equal(isBillableDraftingAuthorized({ investmentState: "maintain_investment", spendAuthorized: false }), false)
console.log("  ✓ isBillableDraftingAuthorized consumes SV1-1 projection only")

const maintainBlocked = upstreamReadyEvidence({
  investmentState: "maintain_investment",
  spendAuthorized: false,
})
assert.equal(resolveEarliestIncompleteDurableStage(maintainBlocked), "investment")
assert.notEqual(projectDurableStateFromStage("investment", maintainBlocked), "waiting_for_generation")
console.log("  ✓ maintain_investment + spend_authorized=false blocks before generation")

const maintainPlan = planDurableStageAdvance({
  evidence: maintainBlocked,
  wake: "personalization_improved",
  now: NOW,
  attemptCounts: emptyAttemptCounts(),
})
assert.equal(maintainPlan.stageEvaluated, "investment")
assert.equal(maintainPlan.outcome, "waiting")
assert.match(maintainPlan.reason, /Investment gate/)
assert.notEqual(maintainPlan.nextEvidence.paused, true)
console.log("  ✓ investment gate waits (does not stop) for maintain_investment")

const authorized = upstreamReadyEvidence({
  investmentState: "increase_investment",
  spendAuthorized: true,
})
assert.equal(resolveEarliestIncompleteDurableStage(authorized), "generation")
assert.equal(projectDurableStateFromStage("generation", authorized), "waiting_for_generation")
console.log("  ✓ increase_investment + spend_authorized=true reaches generation stage")

clearDurableDraftFactoryStoreForTests()

const maintainAdvance = await advanceDraftFactoryForLead({
  organizationId: ORG,
  leadId: "lead-maintain",
  wake: { type: "scheduled_resume", sourceId: "due-maintain" },
  now: NOW,
  evidence: maintainBlocked,
})
assert.notEqual(maintainAdvance.nextState, "waiting_for_generation")
assert.equal(maintainAdvance.nextStage, "investment")
assert.equal(maintainAdvance.outcome, "waiting")
console.log("  ✓ durable advance does not land maintain_investment leads in waiting_for_generation")

const authorizedAdvance = await advanceDraftFactoryForLead({
  organizationId: ORG,
  leadId: "lead-authorized",
  wake: { type: "personalization_improved", sourceId: "pers-auth" },
  now: NOW,
  evidence: authorized,
  completionHints: { completeCurrentStage: true },
})
assert.equal(authorizedAdvance.nextState, "waiting_for_generation")
assert.equal(authorizedAdvance.nextStage, "generation")
console.log("  ✓ authorized leads still reach waiting_for_generation")

const dmStillAllowed = upstreamReadyEvidence({
  investmentState: "maintain_investment",
  spendAuthorized: false,
  decisionMakerAvailable: false,
  contactVerifiedForEmail: false,
  personalizationReady: false,
})
assert.equal(resolveEarliestIncompleteDurableStage(dmStillAllowed), "decision_maker")
console.log("  ✓ upstream stages remain reachable under maintain_investment")

const reconstructed = reconstructDraftFactoryStateFromCanonicalData({
  organizationId: ORG,
  leadId: "lead-reconstruct-maintain",
  evidence: maintainBlocked,
  now: NOW,
})
assert.equal(reconstructed.earliestIncompleteStage, "investment")
assert.notEqual(reconstructed.state, "waiting_for_generation")
console.log("  ✓ reconstruction from canonical evidence respects investment gate")

const liveSource = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(liveSource, /budgetAvailable:\s*true/)
assert.match(liveSource, /killSwitchActive:\s*false/)
assert.doesNotMatch(liveSource, /approvalRequired:\s*true/)
assert.match(liveSource, /spendAuthorized:\s*resource\.spend_authorized/)
console.log("  ✓ buildCanonicalEvidenceForLead matches scheduler SV1-1 signal path")

const engineSource = readSource("lib/growth/draft-factory/draft-factory-durable-engine.ts")
assert.match(engineSource, /isBillableDraftingAuthorized/)
assert.match(engineSource, /if \(!isBillableDraftingAuthorized\(evidence\)\) return "investment"/)
console.log("  ✓ durable engine gates generation on canonical SV1-1 authorization")

const serviceSource = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
assert.match(serviceSource, /isBillableDraftingAuthorized\(nextEvidence\)/)
console.log("  ✓ durable service refuses Growth 5F when billable drafting unauthorized")

console.log(`[${PHASE}] All checks passed.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
