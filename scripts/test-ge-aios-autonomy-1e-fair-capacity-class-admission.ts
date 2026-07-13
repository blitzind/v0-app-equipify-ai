/**
 * GE-AIOS-AUTONOMY-1E — Fair capacity-class admission certification.
 * Run: pnpm test:ge-aios-autonomy-1e-fair-capacity-class-admission
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
  GROWTH_DRAFT_FACTORY_DUE_CLASS_MIN_SAMPLE,
  GROWTH_DRAFT_FACTORY_DUE_CLASS_SAMPLE_COMPARISON_MULTIPLIER,
  computeDueClassEnrichmentSampleSize,
  planFairDueCapacityClassAdmission,
} from "../lib/growth/draft-factory/draft-factory-due-fair-admission"
import { selectPortfolioAwareDueDraftFactoryStates } from "../lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import { GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP } from "../lib/growth/draft-factory/draft-factory-wake-event-types"

const ROOT = process.cwd()
const BLOCK_IMAGING = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_AUTONOMY_1E_QA_MARKER}] Fair capacity-class admission certification`)

assert.equal(GROWTH_AIOS_AUTONOMY_1E_QA_MARKER, "ge-aios-autonomy-1e-fair-capacity-class-admission-v1")
assert.equal(GROWTH_DRAFT_FACTORY_DUE_CLASS_SAMPLE_COMPARISON_MULTIPLIER, 3)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_CLASS_MIN_SAMPLE, 2)
assert.equal(computeDueClassEnrichmentSampleSize({ slotsAllocated: 5 }), 15)
assert.equal(computeDueClassEnrichmentSampleSize({ slotsAllocated: 0 }), 2)
assert.equal(
  computeDueClassEnrichmentSampleSize({ slotsAllocated: 10, perClassCandidateCap: 8 }),
  8,
)
console.log("  ✓ sample-size constants: max(slots×3, 2) capped by perClassCandidateCap")

// --- Block Imaging vs 16 older research ---
const research = []
for (let i = 0; i < 16; i += 1) {
  const day = String(i + 1).padStart(2, "0")
  research.push({
    leadId: `research-${day}`,
    state: "waiting_for_research",
    updatedAt: `2026-06-${day}T12:00:00.000Z`,
  })
}
const blockImaging = {
  leadId: BLOCK_IMAGING,
  state: "waiting_for_dm",
  updatedAt: "2026-07-13T12:40:25.726Z",
}

const admission = planFairDueCapacityClassAdmission({
  dueStates: [...research, blockImaging],
  totalAdvanceBudget: 10,
  perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
})

assert.equal(admission.duePoolCount, 17)
assert.ok(admission.activeCapacityClasses.includes("website_research"))
assert.ok(admission.activeCapacityClasses.includes("decision_maker_discovery"))
assert.equal(admission.rawCountByClass.website_research, 16)
assert.equal(admission.rawCountByClass.decision_maker_discovery, 1)
assert.ok(admission.sampledCandidates.some((row) => row.leadId === BLOCK_IMAGING))
assert.equal(
  admission.sampledCandidates.filter((row) => row.capacityClass === "decision_maker_discovery").length,
  1,
)
assert.ok(admission.sampledCountByClass.website_research <= GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP)
assert.ok(admission.sampledCountByClass.website_research < 16 || admission.sampledCountByClass.website_research === 15)
// With 2 classes / budget 10 → 5 slots each → sample = min(20, max(2, 15)) = 15 research + 1 DM
assert.equal(admission.sampledCountByClass.website_research, 15)
assert.equal(admission.sampledCountByClass.decision_maker_discovery, 1)
console.log("  ✓ full pool classified before SV1-1; research cannot hide waiting_for_dm")

// FIFO inside class
const researchSampled = admission.sampledCandidates
  .filter((row) => row.capacityClass === "website_research")
  .map((row) => row.leadId)
assert.deepEqual(
  researchSampled,
  Array.from({ length: 15 }, (_, i) => `research-${String(i + 1).padStart(2, "0")}`),
)
console.log("  ✓ candidate sampling preserves FIFO within each class")

// Classes not derived from truncated enriched array — source wiring
const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.ok(tickSrc.includes("planFairDueCapacityClassAdmission"))
assert.ok(tickSrc.includes("admission.sampledCandidates"))
assert.ok(tickSrc.includes("selectPortfolioAwareDueDraftFactoryStates"))
assert.equal(/for \(const state of dueStates\)[\s\S]*evaluateResourceAllocationFacade/.test(tickSrc), false)
// Must classify before enrichment loop
const planIdx = tickSrc.indexOf("planFairDueCapacityClassAdmission")
const enrichIdx = tickSrc.indexOf("for (const candidate of admission.sampledCandidates)")
assert.ok(planIdx > 0 && enrichIdx > planIdx)
console.log("  ✓ capacity classes discovered from full pool, not truncated enriched set")

// SV1-1 only on bounded union → portfolio still authority
const enrichedLike = admission.sampledCandidates.map((row) => ({
  leadId: row.leadId,
  state: row.state,
  updatedAt: row.updatedAt,
  investmentState:
    row.leadId === BLOCK_IMAGING
      ? ("increase_investment" as const)
      : ("stop_investment" as const),
  spendAuthorized: row.leadId === BLOCK_IMAGING,
  companyName: row.leadId === BLOCK_IMAGING ? "Block Imaging" : `Research ${row.leadId}`,
  researchFresh: row.leadId === BLOCK_IMAGING,
  researchStale: row.leadId !== BLOCK_IMAGING,
}))
const selection = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "5876176a-61ec-4532-ad99-0c31482d5a91",
  dueStates: enrichedLike,
  totalAdvanceBudget: 10,
  decidedAt: "2026-07-13T16:00:00.000Z",
})
assert.ok(selection.selectedLeadIds.includes(BLOCK_IMAGING))
assert.equal(selection.selectedByClass[BLOCK_IMAGING], "decision_maker_discovery")
assert.equal(
  selection.classSelections.find((row) => row.capacityClass === "website_research")?.skippedStopInvestment,
  15,
)
console.log("  ✓ SV1-1 bounded union + SV1-2 selects Block Imaging; stop_investment research excluded")

// Budget exhaustion must not erase discovered classes (plan is independent of enrichment)
const planOnly = planFairDueCapacityClassAdmission({
  dueStates: [...research, blockImaging],
  totalAdvanceBudget: 10,
})
assert.ok(planOnly.activeCapacityClasses.includes("decision_maker_discovery"))
console.log("  ✓ budget cannot erase class discovery (admission plan is pure)")

// Fresh due-tick startedAt
const schedulerSrc = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
assert.ok(schedulerSrc.includes("tickDraftFactoryDueStatesForScheduler"))
assert.ok(schedulerSrc.includes("AUTONOMY-1E") || schedulerSrc.includes("due tick gets its own clock"))
const dueTickCallMatch = schedulerSrc.match(
  /tickDraftFactoryDueStatesForScheduler\(admin,\s*\{([\s\S]*?)\}\)/,
)
assert.ok(dueTickCallMatch, "due tick call site must exist")
assert.equal(
  /\bstartedAt\s*:/.test(dueTickCallMatch![1]),
  false,
  "due tick must not receive shared cron startedAt",
)
assert.ok(/\bmaxRuntimeMs\s*:\s*15_000/.test(dueTickCallMatch![1]))
assert.ok(schedulerSrc.includes("tickAutonomousSalesLoopForScheduler"))
assert.ok(
  /tickAutonomousSalesLoopForScheduler\(admin,\s*\{[\s\S]*?\bstartedAt\b/.test(schedulerSrc),
  "sales loop still uses scheduler-run startedAt",
)
assert.ok(tickSrc.includes("input.startedAt ?? Date.now()"))
assert.ok(tickSrc.includes("maxRuntimeMs ?? 15_000") || tickSrc.includes("15_000"))
assert.ok(tickSrc.includes("due_tick_started_at"))
assert.ok(tickSrc.includes("budget_exhausted_phase"))
assert.ok(tickSrc.includes("enriched_count_by_class"))
console.log("  ✓ due tick fresh startedAt; 15s cap retained; sales loop cannot steal due budget")

// No duplicate portfolio / no new cron
const fairSrc = readSource("lib/growth/draft-factory/draft-factory-due-fair-admission.ts")
assert.ok(fairSrc.includes("allocateDueSlotsByCapacityClass"))
assert.equal(/evaluatePortfolioAllocationFacade|evaluateResourceAllocationFacade/.test(fairSrc), false)
assert.equal(/vercel\.json|crons\s*:/.test(tickSrc), false)
assert.equal(/apollo|sendOutreach|enrollSequence/i.test(tickSrc), false)
console.log("  ✓ no duplicate portfolio/investment engine; no new cron; no outbound")

// Historical ext failure / retry bridge untouched by this module
const adapter = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts")
assert.ok(adapter.includes("retryEligible") || adapter.includes("retry_eligible"))
assert.ok(adapter.includes("resolveDatamoonAudienceMode"))
console.log("  ✓ retry bridge + mode resolution remain for superseding natural run")

const pkg = readSource("package.json")
assert.ok(pkg.includes("test:ge-aios-autonomy-1e-fair-capacity-class-admission"))
console.log("  ✓ package script registered")

console.log(`\n[${GROWTH_AIOS_AUTONOMY_1E_QA_MARKER}] PASS`)
