/**
 * GE-AIOS-AUTONOMY-1C — Portfolio-Aware Due-State Scheduler certification.
 * Run: pnpm test:ge-aios-autonomy-1c-portfolio-aware-due-scheduler
 *
 * Certifies: due selection reuses SV1-1 + SV1-2 + capacity-class buckets;
 * FIFO is tie-break only; research backlog cannot starve DataMoon DM slots;
 * stop_investment never consumes provider credits via due selection.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  allocateDueSlotsByCapacityClass,
  GROWTH_AIOS_AUTONOMY_1C_QA_MARKER,
  mapDurableStateToPortfolioCapacityClass,
  mapPortfolioCapacityClassToResourceClass,
} from "../lib/growth/draft-factory/draft-factory-due-capacity-class"
import {
  selectPortfolioAwareDueDraftFactoryStates,
  type DuePortfolioSelectionCandidate,
} from "../lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import {
  GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
} from "../lib/growth/draft-factory/draft-factory-wake-event-types"
import { AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER } from "../lib/growth/portfolio-allocation/portfolio-allocation-types"
import { AI_OS_RESOURCE_ALLOCATION_QA_MARKER } from "../lib/growth/resource-allocation/resource-allocation-types"

const ROOT = process.cwd()
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function candidate(
  partial: Partial<DuePortfolioSelectionCandidate> & {
    leadId: string
    state: string
    updatedAt: string
  },
): DuePortfolioSelectionCandidate {
  return {
    leadId: partial.leadId,
    state: partial.state,
    updatedAt: partial.updatedAt,
    investmentState: partial.investmentState ?? "maintain_investment",
    spendAuthorized: partial.spendAuthorized ?? false,
    companyName: partial.companyName ?? `Co ${partial.leadId}`,
    researchFresh: partial.researchFresh ?? null,
    researchStale: partial.researchStale ?? null,
  }
}

console.log(`[${GROWTH_AIOS_AUTONOMY_1C_QA_MARKER}] Portfolio-Aware Due-State Scheduler certification`)

assert.equal(
  GROWTH_AIOS_AUTONOMY_1C_QA_MARKER,
  "ge-aios-autonomy-1c-portfolio-aware-due-scheduler-v1",
)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT, 100)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP, 20)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG, 10)
console.log("  ✓ AUTONOMY-1C markers + pool/cap constants locked")

// --- Stage → capacity class mapping (existing SV1-2 classes only) ---
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_research"), "website_research")
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_dm"), "decision_maker_discovery")
assert.equal(
  mapDurableStateToPortfolioCapacityClass("waiting_for_contact_verification"),
  "datamoon_person_enrichment",
)
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_personalization"), "llm_drafting")
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_generation"), "llm_drafting")
assert.equal(mapDurableStateToPortfolioCapacityClass("waiting_for_approval"), null)
assert.equal(mapPortfolioCapacityClassToResourceClass("decision_maker_discovery"), "datamoon_enrichment")
assert.equal(mapPortfolioCapacityClassToResourceClass("website_research"), "website_research")
console.log("  ✓ durable stage → capacity class → resource class mapping")

// --- Capacity-class fairness: one backlog cannot take the whole budget ---
const slots = allocateDueSlotsByCapacityClass({
  capacityClasses: ["website_research", "decision_maker_discovery"],
  totalBudget: 10,
})
assert.equal(slots.get("website_research"), 5)
assert.equal(slots.get("decision_maker_discovery"), 5)
const three = allocateDueSlotsByCapacityClass({
  capacityClasses: ["website_research", "decision_maker_discovery", "llm_drafting"],
  totalBudget: 10,
})
assert.equal(
  [...three.values()].reduce((a, b) => a + b, 0),
  10,
)
assert.ok(([...three.values()] as number[]).every((n) => n >= 3))
console.log("  ✓ capacity-class slot allocation splits budget fairly")

// --- Research backlog cannot starve DataMoon DM (CONTACT-1D / Block Imaging) ---
const researchBacklog: DuePortfolioSelectionCandidate[] = []
for (let i = 0; i < 16; i += 1) {
  const day = String(i + 1).padStart(2, "0")
  researchBacklog.push(
    candidate({
      leadId: `research-${day}`,
      state: "waiting_for_research",
      updatedAt: `2026-06-${day}T12:00:00.000Z`,
      investmentState: "maintain_investment",
      spendAuthorized: false,
      companyName: `Research Co ${day}`,
      researchStale: true,
    }),
  )
}

const blockImaging = candidate({
  leadId: BLOCK_IMAGING_LEAD_ID,
  state: "waiting_for_dm",
  // Newer than all research rows — FIFO-only would starve this at rank 17.
  updatedAt: "2026-07-13T00:41:00.632Z",
  investmentState: "increase_investment",
  spendAuthorized: true,
  companyName: "Block Imaging",
  researchFresh: true,
  researchStale: false,
})

const selection = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "5876176a-61ec-4532-ad99-0c31482d5a91",
  dueStates: [...researchBacklog, blockImaging],
  totalAdvanceBudget: 10,
  perClassCandidateCap: 20,
  decidedAt: "2026-07-13T01:00:00.000Z",
})

assert.equal(selection.qa_marker, GROWTH_AIOS_AUTONOMY_1C_QA_MARKER)
assert.ok(
  selection.selectedLeadIds.includes(BLOCK_IMAGING_LEAD_ID),
  "Block Imaging with increase_investment + waiting_for_dm must earn a decision_maker_discovery slot",
)
assert.equal(selection.selectedByClass[BLOCK_IMAGING_LEAD_ID], "decision_maker_discovery")
assert.ok(selection.selectedLeadIds.length <= 10)
assert.ok(selection.selectedLeadIds.length >= 2)

const dmClass = selection.classSelections.find((row) => row.capacityClass === "decision_maker_discovery")
const researchClass = selection.classSelections.find((row) => row.capacityClass === "website_research")
assert.ok(dmClass)
assert.ok(researchClass)
assert.equal(dmClass!.slotsAllocated, 5)
assert.equal(researchClass!.slotsAllocated, 5)
assert.ok(dmClass!.selectedLeadIds.includes(BLOCK_IMAGING_LEAD_ID))
assert.equal(researchClass!.selectedLeadIds.includes(BLOCK_IMAGING_LEAD_ID), false)
console.log("  ✓ research backlog cannot starve DataMoon / Block Imaging when eligible")

// --- stop_investment never selected (no provider credit consumption via due selection) ---
const stopLead = candidate({
  leadId: "stop-lead",
  state: "waiting_for_dm",
  updatedAt: "2026-01-01T00:00:00.000Z",
  investmentState: "stop_investment",
  spendAuthorized: false,
  companyName: "Stopped Co",
})
const stopSelection = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "org-stop",
  dueStates: [stopLead, blockImaging],
  totalAdvanceBudget: 10,
  decidedAt: "2026-07-13T01:00:00.000Z",
})
assert.equal(stopSelection.selectedLeadIds.includes("stop-lead"), false)
assert.ok(stopSelection.selectedLeadIds.includes(BLOCK_IMAGING_LEAD_ID))
const stopClass = stopSelection.classSelections.find((row) => row.capacityClass === "decision_maker_discovery")
assert.ok(stopClass)
assert.equal(stopClass!.skippedStopInvestment, 1)
console.log("  ✓ stop_investment never consumes due slots / provider credits")

// --- reduce / maintain cannot take scarce DM slots ---
const maintainDm = candidate({
  leadId: "maintain-dm",
  state: "waiting_for_dm",
  updatedAt: "2026-01-02T00:00:00.000Z",
  investmentState: "maintain_investment",
  spendAuthorized: false,
})
const scarceGate = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "org-scarce",
  dueStates: [maintainDm, blockImaging],
  totalAdvanceBudget: 5,
  decidedAt: "2026-07-13T01:00:00.000Z",
})
assert.equal(scarceGate.selectedLeadIds.includes("maintain-dm"), false)
assert.ok(scarceGate.selectedLeadIds.includes(BLOCK_IMAGING_LEAD_ID))
console.log("  ✓ maintain_investment excluded from scarce decision_maker_discovery slots")

// --- FIFO is tie-break only (equal investment + equal portfolio inputs) ---
const fifoA = candidate({
  leadId: "fifo-a",
  state: "waiting_for_dm",
  updatedAt: "2026-05-01T00:00:00.000Z",
  investmentState: "increase_investment",
  spendAuthorized: true,
  companyName: "FIFO A",
  researchFresh: true,
})
const fifoB = candidate({
  leadId: "fifo-b",
  state: "waiting_for_dm",
  updatedAt: "2026-06-01T00:00:00.000Z",
  investmentState: "increase_investment",
  spendAuthorized: true,
  companyName: "FIFO B",
  researchFresh: true,
})
const fifo = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "org-fifo",
  dueStates: [fifoB, fifoA],
  totalAdvanceBudget: 1,
  decidedAt: "2026-07-13T01:00:00.000Z",
})
assert.deepEqual(fifo.selectedLeadIds, ["fifo-a"])
console.log("  ✓ FIFO (updated_at ASC) retained only as final tie-break")

// --- Deterministic ---
const again = selectPortfolioAwareDueDraftFactoryStates({
  organizationId: "5876176a-61ec-4532-ad99-0c31482d5a91",
  dueStates: [...researchBacklog, blockImaging],
  totalAdvanceBudget: 10,
  perClassCandidateCap: 20,
  decidedAt: "2026-07-13T01:00:00.000Z",
})
assert.deepEqual(again.selectedLeadIds, selection.selectedLeadIds)
assert.deepEqual(again.selectedByClass, selection.selectedByClass)
console.log("  ✓ deterministic execution")

// --- Wiring: reuse engines, no parallel selector / no new cron ---
const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
const selectionSrc = readSource("lib/growth/draft-factory/draft-factory-due-portfolio-selection.ts")
const capacitySrc = readSource("lib/growth/draft-factory/draft-factory-due-capacity-class.ts")
const packageJson = readSource("package.json")

assert.ok(tickSrc.includes("selectPortfolioAwareDueDraftFactoryStates"))
assert.ok(tickSrc.includes("evaluateResourceAllocationFacade"))
assert.ok(tickSrc.includes("GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT"))
assert.ok(tickSrc.includes("advanceDraftFactoryForLeadLive"))
assert.equal(/vercel\.json|crons\s*:/.test(tickSrc), false)
assert.ok(selectionSrc.includes("evaluatePortfolioAllocationFacade"))
assert.ok(selectionSrc.includes("priorityBindingRank"))
assert.equal(/composeNewRank|rankDueStates|dueScore|mlRank/.test(selectionSrc), false)
assert.ok(capacitySrc.includes(GROWTH_AIOS_AUTONOMY_1C_QA_MARKER))
assert.ok(packageJson.includes("test:ge-aios-autonomy-1c-portfolio-aware-due-scheduler"))

// No duplicate investment / portfolio engines inside draft-factory due modules
assert.equal(
  /function evaluateResourceAllocation|function evaluatePortfolioAllocation/.test(
    `${selectionSrc}\n${capacitySrc}`,
  ),
  false,
)
assert.ok(
  selectionSrc.includes(AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER) ||
    selectionSrc.includes("evaluatePortfolioAllocationFacade"),
)
assert.ok(
  tickSrc.includes(AI_OS_RESOURCE_ALLOCATION_QA_MARKER) ||
    tickSrc.includes("evaluateResourceAllocationFacade"),
)
console.log("  ✓ reuses SV1-1 + SV1-2; no duplicate selector; no new cron")

// Objective runtime still owns the tick entry
const schedulerSrc = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
assert.ok(schedulerSrc.includes("tickDraftFactoryDueStatesForScheduler"))
console.log("  ✓ Objective Runtime Scheduler remains the only due tick host")

console.log(`\n[${GROWTH_AIOS_AUTONOMY_1C_QA_MARKER}] PASS`)
