/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1A — Local wiring test.
 *
 * Run: pnpm test:ge-aios-investment-propagation-1a-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildInvestmentChangedWakeSourceId,
  captureGrowthResourceAllocationInputSnapshot,
  GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER,
  hasMaterialResourceAllocationInputChange,
} from "@/lib/growth/revenue-workflow/growth-admission-investment-propagation-1a"
import {
  GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER,
} from "@/lib/growth/training/investment-propagation-production-validation-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const reconciliationSource = readSource(
  "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
)
assert.match(reconciliationSource, /wakeDraftFactoryFromCompletionEvent/)
assert.match(reconciliationSource, /type: "investment_changed"/)
assert.match(reconciliationSource, /hasMaterialResourceAllocationInputChange/)
assert.match(reconciliationSource, /buildInvestmentChangedWakeSourceId/)
assert.doesNotMatch(reconciliationSource, /runAutonomousOutreachPreparationManualRequest/)
console.log("  ✓ reconciliation wires canonical investment_changed wake")

const reconciliationValidation = readSource(
  "lib/growth/training/investment-reconciliation-production-validation-1a.ts",
)
assert.doesNotMatch(reconciliationValidation, /runAutonomousOutreachPreparationManualRequest/)
assert.doesNotMatch(reconciliationValidation, /retriggerOutreachPrep/)
console.log("  ✓ reconciliation validation removed outreach prep retrigger workaround")

const propagationValidation = readSource(
  "lib/growth/training/investment-propagation-production-validation-1a.ts",
)
assert.match(propagationValidation, /wakeDraftFactoryFromCompletionEvent/)
assert.doesNotMatch(propagationValidation, /runAutonomousOutreachPreparationManualRequest/)
console.log("  ✓ propagation validation uses canonical wake only")

const beforeSnapshot = {
  admissionState: "accepted",
  leadStatus: "disqualified",
  stopConditionActive: true,
  stopConditionReason: "Lead status disqualified is a stop condition.",
  investmentState: "stop_investment",
  spendAuthorized: false,
}
const afterSnapshot = {
  admissionState: "accepted",
  leadStatus: "new",
  stopConditionActive: false,
  stopConditionReason: null,
  investmentState: "increase_investment",
  spendAuthorized: true,
}
assert.ok(hasMaterialResourceAllocationInputChange(beforeSnapshot, afterSnapshot))
assert.equal(
  hasMaterialResourceAllocationInputChange(afterSnapshot, afterSnapshot),
  false,
)
const sourceId = buildInvestmentChangedWakeSourceId(afterSnapshot)
assert.match(sourceId, /^admission-reconcile:accepted:new:active:increase_investment:spend:/)
console.log("  ✓ material RA input delta + stable wake sourceId")

const staleLead = {
  id: "e7466319-9112-40a3-af46-d33c63f35823",
  status: "disqualified",
  metadata: { admission_state: "accepted" },
  prospectRecommendedNextAction: "prepare_outreach",
  nextBestAction: null,
  lastProspectResearchedAt: "2026-07-20T05:45:36.082Z",
  latestProspectResearchRunId: "5dd9422b-62b8-4fb2-883e-e75a4da5ec59",
  score: 95,
}
const orgId = "00757488-1026-44a5-aac4-269533ac21be"
const before = captureGrowthResourceAllocationInputSnapshot(staleLead, orgId)
const after = captureGrowthResourceAllocationInputSnapshot(
  { ...staleLead, status: "new" },
  orgId,
)
assert.equal(before.stopConditionActive, true)
assert.equal(after.stopConditionActive, false)
assert.ok(hasMaterialResourceAllocationInputChange(before, after))
console.log("  ✓ disqualified→new reconciliation produces material RA input change")

assert.equal(
  GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER,
  "ge-aios-investment-propagation-1a-v1",
)
assert.equal(
  GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER,
  "ge-aios-investment-propagation-1a-v1",
)

console.log(`[${GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER}] wiring PASS`)
