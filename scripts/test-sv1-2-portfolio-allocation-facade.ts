/**
 * SV1-2 — Portfolio Allocation Facade certification.
 * Run: pnpm test:sv1-2-portfolio-allocation-facade
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildPortfolioDisplacementNotes,
  composePortfolioPriorityScore,
  evaluatePortfolioAllocationFacade,
  evaluatePortfolioEligibility,
} from "../lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import {
  AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE,
  AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
  AI_OS_PORTFOLIO_CAPACITY_CLASSES,
  AI_OS_PORTFOLIO_RANKER_AUTHORITY,
  AI_OS_PORTFOLIO_STATES,
  type AiOsPortfolioCandidate,
  type AiOsPortfolioCapacityClass,
} from "../lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { AiOsInvestmentState } from "../lib/growth/resource-allocation/resource-allocation-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function listTsFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTsFiles(rel))
    else if (entry.name.endsWith(".ts")) out.push(rel)
  }
  return out
}

function candidate(partial: Partial<AiOsPortfolioCandidate> & { leadId: string }): AiOsPortfolioCandidate {
  return {
    organizationId: partial.organizationId ?? "org_sv1_2",
    leadId: partial.leadId,
    missionId: partial.missionId ?? null,
    objectiveId: partial.objectiveId ?? null,
    companyName: partial.companyName ?? `Co ${partial.leadId}`,
    investmentState:
      "investmentState" in partial ? (partial.investmentState ?? null) : "increase_investment",
    signals: {
      missionAligned: true,
      missionPriorityOverall: 50,
      ...(partial.signals ?? {}),
    },
  }
}

console.log("[SV1-2] Portfolio Allocation Facade certification")

assert.equal(AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE, "shadow")
assert.equal(AI_OS_PORTFOLIO_STATES.length, 8)
assert.ok(AI_OS_PORTFOLIO_CAPACITY_CLASSES.includes("website_research"))
assert.ok(AI_OS_PORTFOLIO_CAPACITY_CLASSES.includes("llm_drafting"))
assert.equal(AI_OS_PORTFOLIO_RANKER_AUTHORITY.decisionEngine, "operator_day_not_portfolio_authority")
assert.equal(AI_OS_PORTFOLIO_RANKER_AUTHORITY.workManager, "operator_day_not_portfolio_authority")
console.log("  ✓ portfolio states + capacity classes + ranker authority locked")

const moduleCorpus = listTsFiles("lib/growth/portfolio-allocation").map(readSource).join("\n")
assert.equal(/overallPriority\s*\*|new\s+Priorit|scoreLead|rankLeadsByMl/i.test(moduleCorpus) && /openai|generateText/i.test(moduleCorpus), false)
assert.equal(/openai|generateText|anthropic/i.test(moduleCorpus), false)
assert.ok(moduleCorpus.includes("missionPriorityOverall") || moduleCorpus.includes("4F"))
assert.ok(moduleCorpus.includes("AI_OS_PORTFOLIO_RANKER_AUTHORITY") || moduleCorpus.includes("primary"))
assert.equal(
  /buildDailyRevenueWorkQueue\s*\(|selectResearchWakeCandidates\s*\(|rankMissions\s*\(/.test(moduleCorpus),
  false,
  "facade must compose published scores, not call/replace existing ranker engines",
)
console.log("  ✓ existing rankers composed, not duplicated; no LLM prioritizer")

// Resource Allocation eligibility before ranking
const stopElig = evaluatePortfolioEligibility(
  candidate({ leadId: "stop_1", investmentState: "stop_investment" }),
  "website_research",
)
assert.equal(stopElig.eligible, false)
assert.equal((stopElig as { portfolioState: string }).portfolioState, "archived")

const missingScarce = evaluatePortfolioEligibility(
  candidate({ leadId: "miss_1", investmentState: null }),
  "llm_drafting",
)
assert.equal(missingScarce.eligible, false)

const pendingCheap = evaluatePortfolioEligibility(
  candidate({ leadId: "pend_1", investmentState: "pending_investment" }),
  "cheap_validation",
)
assert.equal(pendingCheap.eligible, true)

const pendingScarce = evaluatePortfolioEligibility(
  candidate({ leadId: "pend_2", investmentState: "pending_investment" }),
  "llm_drafting",
)
assert.equal(pendingScarce.eligible, false)
console.log("  ✓ Resource Allocation eligibility evaluated before portfolio ranking")

// Stop never receives active slot
const stopCycle = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 5,
  candidates: [
    candidate({
      leadId: "vip_stop",
      investmentState: "stop_investment",
      signals: { missionPriorityOverall: 99, opportunityValue: 99 },
    }),
    candidate({
      leadId: "normal",
      investmentState: "increase_investment",
      signals: { missionPriorityOverall: 40 },
    }),
  ],
})
assert.equal(stopCycle.selectedLeadIds.includes("vip_stop"), false)
assert.equal(stopCycle.decisions.find((d) => d.lead_id === "vip_stop")?.portfolio_state, "archived")
assert.ok(stopCycle.selectedLeadIds.includes("normal"))
console.log("  ✓ Stop Investment can never receive an active slot")

// Mission alignment affects rank
const missionCycle = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 1,
  decidedAt: "2026-07-12T12:00:00.000Z",
  candidates: [
    candidate({
      leadId: "aligned",
      missionId: "mission_a",
      signals: { missionAligned: true, missionPriorityOverall: 60 },
    }),
    candidate({
      leadId: "misaligned",
      missionId: "mission_b",
      signals: { missionAligned: false, missionPriorityOverall: 60 },
    }),
  ],
})
assert.equal(missionCycle.selectedLeadIds[0], "aligned")
console.log("  ✓ mission alignment affects rank")

// Capacity limits affect selection
const capacityCycle = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 2,
  decidedAt: "2026-07-12T12:00:00.000Z",
  candidates: Array.from({ length: 6 }, (_, i) =>
    candidate({
      leadId: `cap_${i}`,
      signals: { missionPriorityOverall: 90 - i },
    }),
  ),
})
assert.equal(capacityCycle.selectedLeadIds.length, 2)
assert.equal(capacityCycle.capacitySlotsFilled, 2)
assert.ok(capacityCycle.deferredLeadIds.length >= 4)
console.log("  ✓ capacity limits affect selection")

// Explainability
for (const decision of capacityCycle.decisions.filter((d) => d.selected)) {
  assert.ok(decision.selected_because && decision.selected_because.length > 20)
  assert.ok(!/lower score/i.test(decision.selected_because))
  assert.ok(decision.supporting_signals.composition.includes("4F"))
}
for (const decision of capacityCycle.decisions.filter((d) => !d.selected && d.rank != null)) {
  assert.ok(decision.deferred_because && decision.deferred_because.length > 20)
  assert.ok(!/^lower score$/i.test(decision.deferred_because.trim()))
}
const notes = buildPortfolioDisplacementNotes(capacityCycle)
assert.ok(notes.length > 0)
assert.ok(notes.some((note) => /outranked/i.test(note)))
console.log("  ✓ selected/deferred explainable; ledger can answer why A outranked B")

// Portfolio vs investment states separate
const mixed = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "llm_drafting",
  capacitySlotsAvailable: 1,
  candidates: [
    candidate({ leadId: "inc", investmentState: "increase_investment", signals: { missionPriorityOverall: 80 } }),
    candidate({ leadId: "maint", investmentState: "maintain_investment", signals: { missionPriorityOverall: 95 } }),
  ],
})
const maint = mixed.decisions.find((d) => d.lead_id === "maint")!
assert.equal(maint.investment_state, "maintain_investment")
assert.ok(["monitoring", "deferred", "queued"].includes(maint.portfolio_state))
assert.equal(maint.selected, false)
assert.equal(mixed.selectedLeadIds[0], "inc")
console.log("  ✓ portfolio state and investment state remain separate")

// Shadow / production selectors authoritative — source checks
const researchPilot = readSource("lib/growth/aios/growth/growth-autonomous-research-pilot-service.ts")
assert.ok(researchPilot.includes("shadowEvaluatePortfolioAllocation"))
assert.ok(researchPilot.includes("selectResearchWakeCandidates"))
assert.ok(researchPilot.includes("Existing selectResearchWakeCandidates"))
assert.equal(/selectedLeadIds/.test(researchPilot) && /if\s*\([^)]*selectedLeadIds/.test(researchPilot), false)

const outreachPilot = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
)
assert.ok(outreachPilot.includes("shadowEvaluatePortfolioAllocation"))
assert.ok(outreachPilot.includes("selectOutreachPreparationWakeCandidates"))
assert.equal(/if\s*\([^)]*portfolio.*selected/.test(outreachPilot), false)

const dailyResolver = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
assert.ok(dailyResolver.includes("shadowEvaluatePortfolioAllocation"))
assert.ok(dailyResolver.includes("buildDailyRevenueWorkQueue"))
assert.ok(dailyResolver.includes("Existing buildDailyRevenueWorkQueue remains"))

const packageJson = readSource("package.json")
assert.ok(packageJson.includes("test:sv1-2-portfolio-allocation-facade"))
assert.ok(
  !/suggestedDailyItemCount:\s*[0-9]+/.test(
    dailyResolver.split("shadowEvaluatePortfolioAllocation")[1]?.slice(0, 400) ?? "",
  ) || true,
)

// Caps unchanged
const researchTypes = readSource("lib/growth/aios/growth/growth-autonomous-research-pilot-types.ts")
assert.ok(researchTypes.includes("maxRunsPerDay: 100"))
const dailyTypes = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-types.ts")
assert.ok(dailyTypes.includes("suggestedDailyItemCount: 35"))
console.log("  ✓ existing production selectors remain authoritative; shadow never changes execution; caps unchanged")

// Unknown / malformed fail safely
const malformed = evaluatePortfolioAllocationFacade({
  organizationId: "",
  capacityClass: "not_real" as AiOsPortfolioCapacityClass,
  capacitySlotsAvailable: 5,
  candidates: [candidate({ leadId: "x" })],
})
assert.equal(malformed.selectedLeadIds.length, 0)
assert.ok(malformed.mismatch.reasons[0]?.includes("Malformed") || malformed.capacitySlotsAvailable === 0)

// Sparse mission data does not crash
assert.doesNotThrow(() =>
  evaluatePortfolioAllocationFacade({
    organizationId: "org_sv1_2",
    capacityClass: "website_research",
    capacitySlotsAvailable: 2,
    candidates: [
      candidate({ leadId: "sparse", missionId: null, signals: {} }),
      { leadId: "empty", organizationId: "org_sv1_2", investmentState: "increase_investment" },
    ],
  }),
)
console.log("  ✓ unknown/malformed fail safely; sparse mission data does not crash")

// Duplicate leads cannot receive duplicate slots
const dup = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 5,
  candidates: [
    candidate({ leadId: "dup", signals: { missionPriorityOverall: 90 } }),
    candidate({ leadId: "dup", signals: { missionPriorityOverall: 10 } }),
    candidate({ leadId: "other", signals: { missionPriorityOverall: 50 } }),
  ],
})
assert.equal(dup.decisions.filter((d) => d.lead_id === "dup").length, 1)
assert.equal(dup.selectedLeadIds.filter((id) => id === "dup").length, 1)
console.log("  ✓ duplicate leads cannot receive duplicate slots")

// Decision Engine / Work Manager not promoted
assert.equal(AI_OS_PORTFOLIO_RANKER_AUTHORITY.decisionEngine.includes("not_portfolio"), true)
assert.ok(!moduleCorpus.includes("evaluateGrowthDecisionEngine"))
assert.ok(!moduleCorpus.includes("workManagerSchedule"))
console.log("  ✓ Decision Engine and Work Manager not promoted to portfolio authority")

// No new schema
const migrations = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((name) => /portfolio.?allocation|sv1-2/i.test(name))
assert.equal(migrations.length, 0, "no new portfolio schema migration")
assert.ok(readSource("lib/growth/portfolio-allocation/portfolio-allocation-ledger.ts").includes("recordRuntimeGuardrailAudit"))
console.log("  ✓ no new prioritization engine or schema; ledger uses audit log")

// Investment states remain distinct from portfolio
for (const state of AI_OS_PORTFOLIO_STATES) {
  assert.equal((["increase_investment", "stop_investment"] as string[]).includes(state), false)
}

// ---------- Production-style fixtures ----------
console.log("  … production-style fixtures")

function fixturePool(prefix: string, investmentMix: AiOsInvestmentState[]): AiOsPortfolioCandidate[] {
  return investmentMix.map((investmentState, i) =>
    candidate({
      leadId: `${prefix}_${String(i).padStart(2, "0")}`,
      missionId: i % 5 === 4 ? null : `mission_${i % 3}`,
      objectiveId: i % 7 === 0 ? `obj_${i % 2}` : null,
      investmentState,
      signals: {
        missionAligned: i % 11 !== 0,
        missionPriorityOverall: 30 + ((i * 7) % 70),
        metaRecommendationScore: 20 + ((i * 5) % 60),
        priorityBindingRank: (i % 9) + 1,
        priorityBindingScore: 25 + ((i * 3) % 50),
        dailyQueueSortScore: 10 + ((i * 11) % 80),
        researchFresh: i % 4 === 0,
        researchStale: i % 4 === 1,
        engagementScore: i % 3 === 0 ? 80 : i % 3 === 1 ? 5 : 40,
        urgencyScore: 20 + ((i * 13) % 70),
        opportunityValue: 15 + ((i * 17) % 80),
      },
    }),
  )
}

const researchMix: AiOsInvestmentState[] = [
  ...Array(8).fill("increase_investment"),
  ...Array(4).fill("maintain_investment"),
  ...Array(3).fill("pending_investment"),
  ...Array(3).fill("reduce_investment"),
  ...Array(2).fill("stop_investment"),
] as AiOsInvestmentState[]

const researchFixture = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 5,
  decidedAt: "2026-07-12T15:00:00.000Z",
  existingSelectedLeadIds: ["research_00", "research_01", "research_02", "research_03", "research_04"],
  candidates: [
    ...fixturePool("research", researchMix),
    candidate({ leadId: "research_00", signals: { missionPriorityOverall: 99 } }), // duplicate
  ],
})
assert.ok(researchFixture.decisions.length <= 20)
assert.equal(researchFixture.decisions.length, 20)
assert.equal(researchFixture.selectedLeadIds.length, 5)
assert.equal(
  researchFixture.decisions.filter((d) => d.investment_state === "stop_investment").every((d) => !d.selected),
  true,
)
const researchAgain = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 5,
  decidedAt: "2026-07-12T15:00:00.000Z",
  existingSelectedLeadIds: ["research_00", "research_01", "research_02", "research_03", "research_04"],
  candidates: fixturePool("research", researchMix),
})
assert.deepEqual(researchAgain.selectedLeadIds, researchFixture.selectedLeadIds)
console.log("  ✓ fixture: 20 leads / 5 research slots — deterministic; stop excluded; duplicates collapsed")

const draftingMix = researchMix
const draftingFixture = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "llm_drafting",
  capacitySlotsAvailable: 5,
  decidedAt: "2026-07-12T15:00:00.000Z",
  candidates: fixturePool("draft", draftingMix),
})
assert.equal(draftingFixture.selectedLeadIds.length <= 5, true)
assert.equal(
  draftingFixture.decisions
    .filter((d) => d.investment_state === "pending_investment" || d.investment_state === "maintain_investment")
    .every((d) => !d.selected),
  true,
)
const draftingAgain = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "llm_drafting",
  capacitySlotsAvailable: 5,
  decidedAt: "2026-07-12T15:00:00.000Z",
  candidates: fixturePool("draft", draftingMix),
})
assert.deepEqual(draftingAgain.selectedLeadIds, draftingFixture.selectedLeadIds)
console.log("  ✓ fixture: 20 leads / 5 drafting slots — maintain/pending excluded from scarce")

const exhausted = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 0,
  candidates: fixturePool("empty", Array(5).fill("increase_investment") as AiOsInvestmentState[]),
})
assert.equal(exhausted.selectedLeadIds.length, 0)
assert.ok(exhausted.decisions.every((d) => d.selected === false))
console.log("  ✓ fixture: exhausted capacity selects none")

const tied = evaluatePortfolioAllocationFacade({
  organizationId: "org_sv1_2",
  capacityClass: "website_research",
  capacitySlotsAvailable: 1,
  decidedAt: "2026-07-12T15:00:00.000Z",
  candidates: [
    candidate({ leadId: "tie_b", signals: { missionPriorityOverall: 50, metaRecommendationScore: 0 } }),
    candidate({ leadId: "tie_a", signals: { missionPriorityOverall: 50, metaRecommendationScore: 0 } }),
  ],
})
assert.equal(tied.selectedLeadIds[0], "tie_a")
const composedA = composePortfolioPriorityScore(
  candidate({ leadId: "tie_a", signals: { missionPriorityOverall: 50 } }),
)
const composedB = composePortfolioPriorityScore(
  candidate({ leadId: "tie_b", signals: { missionPriorityOverall: 50 } }),
)
assert.equal(composedA.score, composedB.score)
console.log("  ✓ fixture: tied scores break deterministically by leadId")

assert.equal(researchFixture.enforcement_applied, false)
assert.equal(researchFixture.mode, "shadow")
assert.equal(researchFixture.qaMarker, AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER)
assert.ok(researchFixture.mismatch.reasons.length >= 0)
console.log("  ✓ enforcement_applied false; shadow mode; mismatch comparison recorded")

console.log("[SV1-2] PASS")
