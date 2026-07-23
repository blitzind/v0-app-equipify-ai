/**
 * GE-AIOS-MISSION-BALANCE-1A — Canonical mission prioritization certification.
 *
 * Run: pnpm test:ge-aios-mission-balance-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  applyMissionBalanceToRevenueQueueCards,
  applyMissionBalanceToWorkItems,
  buildMissionBalanceLeadSignals,
  buildMissionBalanceReadModel,
  GROWTH_MISSION_BALANCE_1A_QA_MARKER,
  GROWTH_MISSION_BALANCE_1A_RULE,
  GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS,
  GROWTH_MISSION_BALANCE_PRIORITY_TIERS,
  GROWTH_MISSION_BALANCE_TIER_RANK,
  prioritizeMissionBalanceRows,
} from "@/lib/growth/mission-balance/growth-mission-balance-1a"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
  GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import {
  selectRevenueQueueResearchCandidates,
  selectRevenueQueueReviewResearchCandidates,
} from "@/lib/growth/research/growth-revenue-queue-research-selection"
import { authorizeSpendForInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import {
  buildAdmissionPolicyMetadataFromSufficiency,
  GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import type { GrowthLead } from "@/lib/growth/types"
import { prioritizeWorkItems } from "@/lib/growth/work-manager/scheduler/prioritize-work-items"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-MISSION-BALANCE-1A" as const
const GENERATED_AT = "2026-07-21T12:00:00.000Z"
const ORG_ID = "00757488-1026-44a5-aac4-269533ac21be"

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenAuthority(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createAiWorkOrder",
    "sendEmail",
    "sendSms",
    "executeTransportSend",
    "buildAdmissionPolicyMetadataFromSufficiency(",
    "assessGrowthResearchSufficiency(",
    "resolveLeadAdmissionStateFromMetadata(",
    "prioritizeAndAllocateMissions(",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not re-authority ${token}`)
  }
}

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    companySummary: "Commercial HVAC contractor serving Atlanta metro.",
    websiteSummary: "Preventive maintenance and commercial HVAC service pages.",
    likelyServiceCategory: "HVAC",
    serviceAreaClues: ["Atlanta"],
    companySizeEstimate: "mid-market",
    equipmentServiceIndicators: ["Fleet maintenance", "Commercial HVAC"],
    equipifyPainPoints: ["Manual scheduling"],
    equipifyFitScore: 62,
    outreachAngles: ["Field service automation"],
    recommendedNextAction: "Prepare outreach draft",
    researchConfidence: 0.52,
    sourceUrls: ["https://example.com/services"],
    caveats: [],
    fitModelVersion: "test",
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: null,
    estimatedEmployeeCount: null,
    fleetSizeEstimate: "25 technicians",
    crmDetected: null,
    fieldServiceStackDetected: null,
    ...overrides,
  }
}

function sufficiencyFromResult(
  result: ReturnType<typeof baseResult>,
  lead: Record<string, unknown> = { country: "US", website: "https://metro-hvac.example" },
) {
  const qualification = qualifyGrowthLeadResearch({
    result: result as never,
    researchRunStatus: "succeeded",
  }).qualification
  return assessGrowthResearchSufficiency(
    buildResearchSufficiencyInputFromAssessment({
      result: result as never,
      qualification,
      lead: lead as never,
    }),
  )
}

function buildBoundedMetadata(missingEvidence: string[], extra: Record<string, unknown> = {}) {
  const sufficiency = sufficiencyFromResult(
    baseResult({
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
      websiteSummary: null,
      sourceUrls: [],
    }),
  )
  assert.equal(sufficiency.decision, "targeted_research_required")
  return {
    admission_state: "review",
    requires_human_review: true,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
    admission_targeted_research_missing_evidence: missingEvidence,
    admission_max_additional_investment: GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
    ...extra,
  }
}

function buildPackageReadyMetadata() {
  const sufficiency = sufficiencyFromResult(baseResult())
  assert.equal(sufficiency.packageReady, true)
  return {
    admission_state: "accepted",
    requires_human_review: false,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
  }
}

function leadFixture(input: {
  id: string
  companyName: string
  metadata: Record<string, unknown>
  score?: number
  lastProspectResearchedAt?: string
}): GrowthLead {
  return {
    id: input.id,
    organizationId: ORG_ID,
    companyName: input.companyName,
    website: "https://example.com",
    status: "new",
    score: input.score ?? 55,
    metadata: input.metadata,
    lastProspectResearchedAt: input.lastProspectResearchedAt ?? "2026-07-01T00:00:00.000Z",
    latestProspectResearchRunId: "run-test",
  } as GrowthLead
}

function cardFixture(id: string, companyName: string, intentScore: number): RevenueQueueCardView {
  return {
    id,
    company_name: companyName,
    domain: "example.com",
    lead_score: 55,
    intent_score: intentScore,
    intent_grade: "B",
    verification_state: "verified",
    candidate_type: "inbound",
    candidate_priority: "medium",
    recommended_motion: "research",
    recommended_urgency: "medium",
    recommended_owner: "ava",
    human_approval_state: "none",
    owner_id: null,
    status: "new",
    pipeline_status: "research",
    human_review_required: true,
    session_count: 0,
    visit_count: 0,
    candidate_confidence: 0.5,
    last_activity_at: GENERATED_AT,
    time_since_activity_label: "today",
    intent_indicators: [],
    has_operator_handoff: false,
    has_lead_engine_run: true,
  }
}

function workItemFixture(input: {
  id: string
  sourceId: string
  type: AvaWorkItem["type"]
  score: number
  requiresOperator?: boolean
}): AvaWorkItem {
  return {
    id: input.id,
    type: input.type,
    title: `Work ${input.id}`,
    description: null,
    status: "planned",
    priority: input.score,
    source: "decision_engine",
    created_at: GENERATED_AT,
    updated_at: GENERATED_AT,
    estimated_minutes: 10,
    estimated_revenue_impact: null,
    requires_operator: input.requiresOperator ?? false,
    can_execute_autonomously: !input.requiresOperator,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: input.score,
    confidence: 0.5,
    href: null,
    company_name: input.sourceId,
    decision_source_id: input.sourceId,
  }
}

console.log(`\n${PHASE} — certification\n`)

runGate("Authority map — consumer only, no upstream re-authority", () => {
  assert.equal(GROWTH_MISSION_BALANCE_1A_QA_MARKER, "ge-aios-mission-balance-1a-v1")
  assert.match(GROWTH_MISSION_BALANCE_1A_RULE, /already-authorized/)
  assertNoForbiddenAuthority("lib/growth/mission-balance/growth-mission-balance-1a.ts")
  const readModel = buildMissionBalanceReadModel({ leads: [], generatedAt: GENERATED_AT })
  assert.deepEqual(readModel.authorityChain.slice(0, 5), [
    "Research Sufficiency",
    "Admission Policy",
    "Investment Propagation",
    "Resource Allocation (SV1-1)",
    "Mission Balance",
  ])
})

runGate("Canonical input classification documented", () => {
  assert.ok(GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS.canonical.includes("sendReady"))
  assert.ok(GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS.derived.includes("priorityTier"))
  assert.ok(GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS.presentationOnly.includes("decision_score"))
  assert.ok(GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS.legacy.includes("qualificationRecommendation"))
})

runGate("Priority tiers — policy order not fixed scores", () => {
  assert.deepEqual(GROWTH_MISSION_BALANCE_PRIORITY_TIERS.slice(1, 5), [
    "package_ready_execution",
    "bounded_research_authorized",
    "high_value_targeted_research",
    "operator_review_preparation",
  ])
  assert.ok(
    GROWTH_MISSION_BALANCE_TIER_RANK.package_ready_execution <
      GROWTH_MISSION_BALANCE_TIER_RANK.bounded_research_authorized,
  )
  assert.ok(
    GROWTH_MISSION_BALANCE_TIER_RANK.bounded_research_authorized <
      GROWTH_MISSION_BALANCE_TIER_RANK.operator_review_preparation,
  )
})

runGate("Fixture A — package-ready work outranks bounded research despite lower decision score", () => {
  const packageLead = leadFixture({
    id: "lead-package",
    companyName: "Package Ready Co",
    metadata: buildPackageReadyMetadata(),
  })
  const boundedLead = leadFixture({
    id: "lead-bounded",
    companyName: "Bounded Co",
    metadata: buildBoundedMetadata(["verified_company_identity"], {
      admission_bounded_actions_completed: ["verify_company_identity"],
      admission_targeted_research_passes_used: 1,
      admission_targeted_research_missing_evidence: ["operational_fit"],
    }),
    score: 90,
  })
  const leads = [boundedLead, packageLead]
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
  const items = [
    workItemFixture({ id: "w-bounded", sourceId: "lead-bounded", type: "research", score: 90 }),
    workItemFixture({ id: "w-package", sourceId: "lead-package", type: "outreach", score: 40 }),
  ]
  const ordered = applyMissionBalanceToWorkItems(items, leadsById, {
    generatedAt: GENERATED_AT,
    organizationId: ORG_ID,
  })
  assert.deepEqual(
    ordered.map((row) => row.id),
    ["w-package", "w-bounded"],
  )
})

runGate("Fixture B — bounded research outranks passive operator review prep", () => {
  const boundedLead = leadFixture({
    id: "lead-bounded-b",
    companyName: "Bounded B",
    metadata: buildBoundedMetadata(["verified_company_identity"]),
  })
  const passiveLead = leadFixture({
    id: "lead-passive",
    companyName: "Passive Review",
    metadata: {
      admission_state: "review",
      requires_human_review: true,
      admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    },
  })
  const cards = [
    cardFixture("lead-passive", "Passive Review", 95),
    cardFixture("lead-bounded-b", "Bounded B", 40),
  ]
  const ordered = applyMissionBalanceToRevenueQueueCards(cards, [boundedLead, passiveLead], {
    generatedAt: GENERATED_AT,
    organizationId: ORG_ID,
  })
  assert.deepEqual(
    ordered.map((row) => row.id),
    ["lead-bounded-b", "lead-passive"],
  )
})

runGate("Fixture C — deterministic ordering is stable", () => {
  const leads = [
    leadFixture({
      id: "lead-a",
      companyName: "A",
      metadata: buildBoundedMetadata(["verified_company_identity"]),
    }),
    leadFixture({
      id: "lead-b",
      companyName: "B",
      metadata: buildBoundedMetadata(["operational_fit"]),
    }),
  ]
  const cards = [cardFixture("lead-b", "B", 50), cardFixture("lead-a", "A", 50)]
  const first = applyMissionBalanceToRevenueQueueCards(cards, leads, { generatedAt: GENERATED_AT, organizationId: ORG_ID })
  const second = applyMissionBalanceToRevenueQueueCards(cards, leads, { generatedAt: GENERATED_AT, organizationId: ORG_ID })
  assert.deepEqual(
    first.map((row) => row.id),
    second.map((row) => row.id),
  )
})

runGate("Fixture D — nearing sufficiency bounded work ranks above fresh bounded work", () => {
  const nearLead = leadFixture({
    id: "lead-near",
    companyName: "Near Sufficiency",
    metadata: buildBoundedMetadata(["operational_fit"], {
      admission_bounded_actions_completed: ["verify_company_identity", "verify_us_territory"],
      admission_targeted_research_passes_used: 2,
    }),
  })
  const freshLead = leadFixture({
    id: "lead-fresh",
    companyName: "Fresh Bounded",
    metadata: buildBoundedMetadata(["verified_company_identity", "operational_fit"]),
  })
  const nearSignals = buildMissionBalanceLeadSignals(nearLead, GENERATED_AT, ORG_ID)
  const freshSignals = buildMissionBalanceLeadSignals(freshLead, GENERATED_AT, ORG_ID)
  assert.ok(nearSignals.sufficiencyProximityScore > freshSignals.sufficiencyProximityScore)
  const ordered = prioritizeMissionBalanceRows([
    {
      id: "fresh",
      leadId: "lead-fresh",
      tier: "bounded_research_authorized",
      tierRank: GROWTH_MISSION_BALANCE_TIER_RANK.bounded_research_authorized,
      sufficiencyProximityScore: freshSignals.sufficiencyProximityScore,
      staleWorkAgeMs: 0,
      decisionScoreTiebreak: 50,
      spendAuthorized: true,
      reason: "fresh",
    },
    {
      id: "near",
      leadId: "lead-near",
      tier: "bounded_research_authorized",
      tierRank: GROWTH_MISSION_BALANCE_TIER_RANK.bounded_research_authorized,
      sufficiencyProximityScore: nearSignals.sufficiencyProximityScore,
      staleWorkAgeMs: 0,
      decisionScoreTiebreak: 50,
      spendAuthorized: true,
      reason: "near",
    },
  ])
  assert.deepEqual(
    ordered.map((row) => row.id),
    ["near", "fresh"],
  )
})

runGate("Fixture E — transport remains disabled (outbound never authorized)", () => {
  assert.equal(authorizeSpendForInvestmentState("increase_investment", "outbound"), false)
  assert.equal(authorizeSpendForInvestmentState("pending_investment", "outbound"), false)
  const packageLead = leadFixture({
    id: "lead-send",
    companyName: "Send Ready",
    metadata: buildPackageReadyMetadata(),
  })
  const signals = buildMissionBalanceLeadSignals(packageLead, GENERATED_AT, ORG_ID)
  assert.equal(signals.sendReady, false)
})

runGate("Work Manager integration — prioritizeWorkItems consumes Mission Balance when leads provided", () => {
  const source = readSource("lib/growth/work-manager/scheduler/prioritize-work-items.ts")
  assert.match(source, /applyMissionBalanceToWorkItems/)
  const packageLead = leadFixture({
    id: "lead-wm-package",
    companyName: "WM Package",
    metadata: buildPackageReadyMetadata(),
  })
  const boundedLead = leadFixture({
    id: "lead-wm-bounded",
    companyName: "WM Bounded",
    metadata: buildBoundedMetadata(["verified_company_identity"]),
  })
  const leadsById = new Map([
    [packageLead.id, packageLead],
    [boundedLead.id, boundedLead],
  ])
  const ordered = prioritizeWorkItems(
    [
      workItemFixture({ id: "wm-bounded", sourceId: boundedLead.id, type: "research", score: 99 }),
      workItemFixture({ id: "wm-package", sourceId: packageLead.id, type: "approval", score: 10 }),
    ],
    { leadsById, generatedAt: GENERATED_AT, organizationId: ORG_ID },
  )
  assert.equal(ordered[0]?.id, "wm-package")
})

runGate("Revenue queue integration — selection applies Mission Balance reorder", () => {
  const selectionSource = readSource("lib/growth/research/growth-revenue-queue-research-selection.ts")
  assert.match(selectionSource, /applyMissionBalanceToRevenueQueueCards/)
  const boundedLead = leadFixture({
    id: "lead-rq-bounded",
    companyName: "RQ Bounded",
    metadata: buildBoundedMetadata(["verified_company_identity"]),
  })
  const passiveLead = leadFixture({
    id: "lead-rq-passive",
    companyName: "RQ Passive",
    metadata: {
      admission_state: "review",
      requires_human_review: true,
      admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    },
  })
  const leads = [passiveLead, boundedLead]
  const selected = selectRevenueQueueResearchCandidates(leads, 5)
  const boundedIndex = selected.findIndex((row) => row.id === boundedLead.id)
  const passiveIndex = selected.findIndex((row) => row.id === passiveLead.id)
  if (boundedIndex >= 0 && passiveIndex >= 0) {
    assert.ok(boundedIndex < passiveIndex)
  }
})

runGate("Regression chain — investment propagation 1b execution closure", () => {
  const result = spawnSync("pnpm", ["test:ge-aios-investment-propagation-1b-execution-closure"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

runGate("Regression chain — 4F mission priority engine (read model remains separate)", () => {
  const result = spawnSync("pnpm", ["test:ge-aios-growth-4f-priority-engine"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

runGate("Regression chain — live 8B research projection (source wiring)", () => {
  const selectionSource = readSource("lib/growth/research/growth-revenue-queue-research-selection.ts")
  assert.match(selectionSource, /selectRevenueQueueReviewResearchCandidates/)
  assert.match(selectionSource, /applyMissionBalanceToRevenueQueueCards/)
  const result = spawnSync(
    "node",
    [
      "-r",
      "./scripts/server-only-shim.cjs",
      "--import",
      "tsx",
      "scripts/test-ge-aios-live-8b-work-manager-research-projection.ts",
    ],
    { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" },
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

runGate("Regression chain — 5B autonomous research agent", () => {
  const result = spawnSync("pnpm", ["test:ge-aios-growth-5b-autonomous-research-agent"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

console.log(`\n${PHASE} — all gates passed\n`)
