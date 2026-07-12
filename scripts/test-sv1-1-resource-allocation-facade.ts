/**
 * SV1-1 — Resource Allocation Facade certification.
 * Run: pnpm test:sv1-1-resource-allocation-facade
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  authorizeSpendForInvestmentState,
  evaluateResourceAllocationFacade,
  projectInvestmentStateFromSignals,
} from "../lib/growth/resource-allocation/resource-allocation-facade-engine"
import {
  AI_OS_INVESTMENT_STATES,
  AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE,
  AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
  AI_OS_RESOURCE_COST_TIER_BY_CLASS,
  AI_OS_SCARCE_RESOURCE_CLASSES,
  type AiOsScarceResourceClass,
} from "../lib/growth/resource-allocation/resource-allocation-types"

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

console.log("[SV1-1] Resource Allocation Facade certification")

assert.equal(AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE, "shadow")
assert.equal(AI_OS_INVESTMENT_STATES.length, 5)
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("website_research"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("datamoon_enrichment"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("llm_generation"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("email_drafting"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("sequence_preparation"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("voice_generation"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("sms_generation"))
assert.ok(AI_OS_SCARCE_RESOURCE_CLASSES.includes("browser_automation"))
console.log("  ✓ investment states + scarce resource classes locked")

const moduleFiles = listTsFiles("lib/growth/resource-allocation")
assert.ok(moduleFiles.length >= 4)
const moduleCorpus = moduleFiles.map(readSource).join("\n")

assert.equal(
  /evaluateAutonomousQualification|runAutonomousQualification|scoreLeadQualification|computeQualification/i.test(
    moduleCorpus,
  ),
  false,
  "facade must not embed duplicate qualification logic",
)
assert.equal(
  /enforceOutreachPreparationAgentBudget|consumeRuntimeBudget|checkCascadeBudget/i.test(moduleCorpus),
  false,
  "facade must not reimplement budget math",
)
assert.equal(/openai|generateText|anthropic/i.test(moduleCorpus), false, "facade must not call LLMs")
console.log("  ✓ no duplicate qualification / budget / LLM engines")

// 1–4 — compose existing decisions (qualification / budgets / stops remain authoritative)
const stopDecision = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "website_research",
  signals: {
    stopConditionActive: true,
    stopConditionReason: "Operator stop",
    admission: { state: "accepted" },
    budgetAvailable: true,
    evidenceConfidence: 0.95,
  },
})
assert.equal(stopDecision.investment_state, "stop_investment")
assert.equal(stopDecision.spend_authorized, false)
assert.ok(stopDecision.blocking_conditions.includes("stop_condition_active"))
console.log("  ✓ existing stop conditions remain authoritative")

const budgetDecision = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "llm_generation",
  signals: {
    admission: { state: "accepted" },
    budgetAvailable: false,
    evidenceConfidence: 0.9,
  },
})
assert.equal(budgetDecision.investment_state, "reduce_investment")
assert.equal(budgetDecision.spend_authorized, false)
assert.ok(budgetDecision.blocking_conditions.includes("budget_exhausted"))
console.log("  ✓ existing budgets remain authoritative")

const qualificationDecision = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "email_drafting",
  signals: {
    admission: { state: "accepted" },
    budgetAvailable: true,
    qualificationRecommendation: "abandon_lead",
    evidenceConfidence: 0.9,
  },
})
assert.equal(qualificationDecision.investment_state, "stop_investment")
assert.equal(qualificationDecision.spend_authorized, false)
assert.ok(qualificationDecision.blocking_conditions.includes("qualification_stop"))
console.log("  ✓ existing qualification remains authoritative")

const admissionReject = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "website_research",
  signals: {
    admission: { state: "rejected" },
    budgetAvailable: true,
  },
})
assert.equal(admissionReject.investment_state, "stop_investment")
assert.equal(admissionReject.spend_authorized, false)

const pendingApproval = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "email_drafting",
  signals: {
    admission: { state: "accepted" },
    budgetAvailable: true,
    evidenceConfidence: 0.8,
    approvalRequired: true,
    approvalGranted: false,
  },
})
assert.equal(pendingApproval.investment_state, "pending_investment")
assert.equal(pendingApproval.spend_authorized, false)

const increase = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "llm_generation",
  signals: {
    admission: { state: "accepted" },
    budgetAvailable: true,
    evidenceConfidence: 0.85,
    qualificationRecommendation: "prepare_outreach",
  },
})
assert.equal(increase.investment_state, "increase_investment")
assert.equal(increase.spend_authorized, true)
assert.equal(increase.qaMarker, AI_OS_RESOURCE_ALLOCATION_QA_MARKER)
assert.equal(increase.enforcement_applied, false)
assert.equal(increase.mode, "shadow")
console.log("  ✓ facade composes admission / approval / confidence signals")

// 6 — shadow mode never changes production execution
const researchExec = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
assert.ok(researchExec.includes("shadowEvaluateResourceAllocation"))
assert.ok(researchExec.includes('resourceClass: "website_research"'))
assert.ok(researchExec.includes("Existing admission / freshness / force gates below remain"))
// Must not branch production path on facade spend_authorized
assert.equal(
  /if\s*\([^)]*spend_authorized[^)]*\)/.test(researchExec),
  false,
  "research execution must not branch on spend_authorized",
)
assert.ok(researchExec.includes("shouldAutoQueueLeadResearch"))
assert.ok(researchExec.includes("admission_blocked") || researchExec.includes("admissionState"))

const outreachPrep = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
)
assert.ok(outreachPrep.includes("shadowEvaluateResourceAllocation"))
assert.ok(outreachPrep.includes('resourceClass: "sequence_preparation"'))
assert.equal(
  /if\s*\([^)]*spend_authorized[^)]*\)/.test(outreachPrep),
  false,
  "outreach prep must not branch on spend_authorized",
)
assert.ok(outreachPrep.includes("enforceOutreachPreparationAgentBudget"))
console.log("  ✓ shadow mode wired; production allow/deny unchanged")

// 7 — every governed resource receives a deterministic decision
for (const resourceClass of AI_OS_SCARCE_RESOURCE_CLASSES) {
  const decision = evaluateResourceAllocationFacade({
    organizationId: "org_1",
    accountId: "lead_1",
    resourceClass: resourceClass as AiOsScarceResourceClass,
    signals: {
      admission: { state: "accepted" },
      budgetAvailable: true,
      evidenceConfidence: 0.8,
      qualificationRecommendation: "pursue",
    },
  })
  assert.ok(AI_OS_INVESTMENT_STATES.includes(decision.investment_state))
  assert.equal(typeof decision.spend_authorized, "boolean")
  assert.equal(decision.resource_class, resourceClass)
  assert.equal(decision.cost_tier, AI_OS_RESOURCE_COST_TIER_BY_CLASS[resourceClass])
  assert.ok(decision.reason.length > 0)
  assert.equal(decision.enforcement_applied, false)

  // Determinism: same inputs → same state/auth
  const again = evaluateResourceAllocationFacade({
    organizationId: "org_1",
    accountId: "lead_1",
    resourceClass: resourceClass as AiOsScarceResourceClass,
    signals: {
      admission: { state: "accepted" },
      budgetAvailable: true,
      evidenceConfidence: 0.8,
      qualificationRecommendation: "pursue",
    },
  })
  assert.equal(again.investment_state, decision.investment_state)
  assert.equal(again.spend_authorized, decision.spend_authorized)
}
console.log("  ✓ every governed resource gets a deterministic decision")

// 8 — Stop Investment denies authorization
assert.equal(authorizeSpendForInvestmentState("stop_investment", "low_cost"), false)
assert.equal(authorizeSpendForInvestmentState("stop_investment", "billable"), false)
assert.equal(authorizeSpendForInvestmentState("stop_investment", "outbound"), false)
console.log("  ✓ Stop Investment denies authorization")

// 9 — Unknown state / resource fails closed
const unknownResource = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "not_a_real_resource" as AiOsScarceResourceClass,
  signals: { admission: { state: "accepted" } },
})
assert.equal(unknownResource.investment_state, "stop_investment")
assert.equal(unknownResource.spend_authorized, false)
assert.ok(unknownResource.blocking_conditions.includes("unknown_resource_class"))

const missingIdentity = evaluateResourceAllocationFacade({
  organizationId: "",
  accountId: "",
  resourceClass: "website_research",
  signals: {},
})
assert.equal(missingIdentity.investment_state, "stop_investment")
assert.equal(missingIdentity.spend_authorized, false)

const projected = projectInvestmentStateFromSignals({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "website_research",
  signals: { admission: { state: "accepted" }, budgetAvailable: true },
})
assert.ok(AI_OS_INVESTMENT_STATES.includes(projected.investment_state))
console.log("  ✓ unknown / missing identity fail closed")

// 10 — Existing APIs remain unchanged (route wrappers still thin / same exports)
const researchRoute = readSource("app/api/platform/growth/leads/[leadId]/research/route.ts")
assert.ok(
  researchRoute.includes("routeCanonicalProspectResearch") ||
    researchRoute.includes("executeGrowthLeadProspectResearch") ||
    researchRoute.includes("deprecated"),
)
assert.equal(researchRoute.includes("evaluateResourceAllocationFacade"), false)
assert.equal(researchRoute.includes("spend_authorized"), false)

const packageJson = readSource("package.json")
assert.ok(packageJson.includes("test:sv1-1-resource-allocation-facade"))

const facadeService = readSource("lib/growth/resource-allocation/resource-allocation-facade.ts")
assert.ok(facadeService.includes("enforcement_applied: false"))
assert.ok(facadeService.includes('mode: "shadow"') || facadeService.includes("shadow"))

const ledger = readSource("lib/growth/resource-allocation/resource-allocation-ledger.ts")
assert.ok(ledger.includes("recordRuntimeGuardrailAudit"))
assert.ok(ledger.includes("resource_allocation_ledger"))
assert.ok(ledger.includes("estimatedResourceClass"))
assert.ok(ledger.includes("investmentState"))
console.log("  ✓ existing APIs unchanged; ledger records shadow decisions")

// Outbound never authorized by facade
assert.equal(authorizeSpendForInvestmentState("increase_investment", "outbound"), false)
const voice = evaluateResourceAllocationFacade({
  organizationId: "org_1",
  accountId: "lead_1",
  resourceClass: "voice_generation",
  signals: {
    admission: { state: "accepted" },
    budgetAvailable: true,
    evidenceConfidence: 0.95,
    qualificationRecommendation: "pursue",
  },
})
assert.equal(voice.spend_authorized, false)
assert.ok(voice.blocking_conditions.includes("outbound_requires_separate_approval") || voice.spend_authorized === false)
console.log("  ✓ outbound transport remains separately approval-gated")

console.log("[SV1-1] PASS")
