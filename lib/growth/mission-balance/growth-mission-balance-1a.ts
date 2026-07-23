/**
 * GE-AIOS-MISSION-BALANCE-1A — Canonical mission prioritization consumer.
 * Reorders already-authorized work only. Does not invent, admit, budget, or send.
 */

import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  evaluateResourceAllocationFacade,
  authorizeSpendForInvestmentState,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthLead } from "@/lib/growth/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import {
  buildBoundedResearchOperatorProjection,
  evaluateBoundedResearchExecutionGate,
  readCompletedBoundedResearchActionKeys,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-execution-closure"
import {
  GROWTH_MISSION_BALANCE_1A_QA_MARKER,
  GROWTH_MISSION_BALANCE_1A_RULE,
  GROWTH_MISSION_BALANCE_TIER_RANK,
  type GrowthMissionBalanceCapacityConstraints,
  type GrowthMissionBalanceLeadSignals,
  type GrowthMissionBalanceOrderingRow,
  type GrowthMissionBalancePriorityTier,
  type GrowthMissionBalanceReadModel,
} from "@/lib/growth/mission-balance/growth-mission-balance-1a-types"

const DEFAULT_CAPACITY: GrowthMissionBalanceCapacityConstraints = {
  maxAutonomousCandidates: null,
  operatorWorkloadActive: false,
  killSwitchActive: false,
  transportDisabled: true,
}

const AUTHORITY_CHAIN = [
  "Research Sufficiency",
  "Admission Policy",
  "Investment Propagation",
  "Resource Allocation (SV1-1)",
  "Mission Balance",
  "Work Manager",
  "Execution",
] as const

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveStaleWorkAgeMs(lead: Pick<GrowthLead, "lastProspectResearchedAt">, generatedAt: string): number {
  const researchedAt = parseTime(lead.lastProspectResearchedAt)
  const now = parseTime(generatedAt)
  if (researchedAt <= 0 || now <= 0) return Number.MAX_SAFE_INTEGER
  if (isProspectResearchStale(lead.lastProspectResearchedAt)) {
    return Math.max(0, now - researchedAt)
  }
  return 0
}

export function buildMissionBalanceLeadSignals(
  lead: GrowthLead,
  generatedAt: string,
  organizationId: string = "mission-balance-local",
): GrowthMissionBalanceLeadSignals {
  const metadata = lead.metadata ?? {}
  const raSignals = buildResourceAllocationSignalsFromLead(lead)
  const ra = evaluateResourceAllocationFacade({
    organizationId,
    accountId: lead.id,
    accountKind: "lead",
    resourceClass: "website_research",
    signals: raSignals,
  })
  const bounded = buildBoundedResearchOperatorProjection(metadata)
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  const auth = raSignals.boundedResearchAuthorization
  const completedActionKeys = readCompletedBoundedResearchActionKeys(metadata)
  const missingEvidenceCount = auth?.missingRequiredEvidence.length ?? 0
  const completed = completedActionKeys.length
  const total = Math.max(1, completed + missingEvidenceCount)

  const baseSignals = {
    leadId: lead.id,
    packageReady: raSignals.researchSufficientForPackage === true,
    sendReady: raSignals.sendReady === true,
    investmentState: ra.investment_state,
    spendAuthorizedForResearch:
      ra.spend_authorized &&
      authorizeSpendForInvestmentState(ra.investment_state, "low_cost"),
    boundedAuthorized: bounded.authorized && gate.authorized,
    boundedActionAvailable: bounded.currentActionKey != null && !bounded.exhausted,
    boundedBudgetRemaining: bounded.passesRemaining,
    boundedActionsCompleted: completed,
    boundedActionsTotal: total,
    admissionState: raSignals.admission?.state ?? null,
    requiresOperatorReview: raSignals.admission?.requiresHumanReview === true,
    staleWorkAgeMs: resolveStaleWorkAgeMs(lead, generatedAt),
    evidenceConfidence: raSignals.evidenceConfidence ?? null,
  }

  return {
    ...baseSignals,
    sufficiencyProximityScore: computeSufficiencyProximityScore(baseSignals),
  }
}

function resolveWorkItemTier(
  item: AvaWorkItem,
  signals: GrowthMissionBalanceLeadSignals | null,
): GrowthMissionBalancePriorityTier {
  if (item.type === "reply") return "customer_reply_interrupt"

  if (signals?.packageReady && (item.type === "outreach" || item.type === "approval" || item.type === "research")) {
    return "package_ready_execution"
  }

  if (
    signals?.boundedAuthorized &&
    signals.boundedActionAvailable &&
    signals.spendAuthorizedForResearch &&
    item.type === "research"
  ) {
    return "bounded_research_authorized"
  }

  if (signals?.spendAuthorizedForResearch && item.type === "research") {
    if (signals.investmentState === "increase_investment" || signals.investmentState === "pending_investment") {
      return "high_value_targeted_research"
    }
  }

  if (item.requires_operator || item.type === "approval" || signals?.requiresOperatorReview) {
    return "operator_review_preparation"
  }

  if (item.type === "research" || item.type === "qualification" || item.type === "mission") {
    return signals?.spendAuthorizedForResearch ? "high_value_targeted_research" : "background_improvement"
  }

  return "background_improvement"
}

function resolveRevenueQueueTier(
  signals: GrowthMissionBalanceLeadSignals,
): GrowthMissionBalancePriorityTier {
  if (signals.packageReady) return "package_ready_execution"
  if (signals.boundedAuthorized && signals.boundedActionAvailable && signals.spendAuthorizedForResearch) {
    return "bounded_research_authorized"
  }
  if (signals.spendAuthorizedForResearch && signals.requiresOperatorReview) {
    return "operator_review_preparation"
  }
  if (signals.spendAuthorizedForResearch) return "high_value_targeted_research"
  return "background_improvement"
}

function computeSufficiencyProximityScore(signals: Omit<GrowthMissionBalanceLeadSignals, "sufficiencyProximityScore">): number {
  if (signals.packageReady) return 100
  const completionRatio = signals.boundedActionsCompleted / Math.max(1, signals.boundedActionsTotal)
  const remainingActions = Math.max(0, signals.boundedActionsTotal - signals.boundedActionsCompleted)
  const nearnessBonus = remainingActions <= 1 ? 20 : remainingActions === 2 ? 10 : 0
  return Math.round(completionRatio * 70 + nearnessBonus)
}

function compareOrderingRows(left: GrowthMissionBalanceOrderingRow, right: GrowthMissionBalanceOrderingRow): number {
  if (left.tierRank !== right.tierRank) return left.tierRank - right.tierRank
  if (left.sufficiencyProximityScore !== right.sufficiencyProximityScore) {
    return right.sufficiencyProximityScore - left.sufficiencyProximityScore
  }
  if (left.staleWorkAgeMs !== right.staleWorkAgeMs) return right.staleWorkAgeMs - left.staleWorkAgeMs
  if (left.decisionScoreTiebreak !== right.decisionScoreTiebreak) {
    return right.decisionScoreTiebreak - left.decisionScoreTiebreak
  }
  return left.id.localeCompare(right.id)
}

function buildOrderingRow(input: {
  id: string
  leadId: string | null
  tier: GrowthMissionBalancePriorityTier
  signals: GrowthMissionBalanceLeadSignals | null
  decisionScoreTiebreak: number
  spendAuthorized: boolean
}): GrowthMissionBalanceOrderingRow {
  const proximity = input.signals?.sufficiencyProximityScore ?? 0
  return {
    id: input.id,
    leadId: input.leadId,
    tier: input.tier,
    tierRank: GROWTH_MISSION_BALANCE_TIER_RANK[input.tier],
    sufficiencyProximityScore: proximity,
    staleWorkAgeMs: input.signals?.staleWorkAgeMs ?? 0,
    decisionScoreTiebreak: input.decisionScoreTiebreak,
    spendAuthorized: input.spendAuthorized,
    reason: `${input.tier} — proximity ${proximity}, stale ${input.signals?.staleWorkAgeMs ?? 0}ms`,
  }
}

export function prioritizeMissionBalanceRows(rows: GrowthMissionBalanceOrderingRow[]): GrowthMissionBalanceOrderingRow[] {
  return [...rows].sort(compareOrderingRows)
}

export function applyMissionBalanceToWorkItems(
  items: AvaWorkItem[],
  leadsById: ReadonlyMap<string, GrowthLead>,
  options?: {
    generatedAt?: string
    organizationId?: string
    capacity?: Partial<GrowthMissionBalanceCapacityConstraints>
  },
): AvaWorkItem[] {
  const generatedAt = options?.generatedAt ?? new Date().toISOString()
  const capacity = { ...DEFAULT_CAPACITY, ...(options?.capacity ?? {}) }
  const rows = items.map((item) => {
    const lead = leadsById.get(item.decision_source_id) ?? null
    const signals = lead ? buildMissionBalanceLeadSignals(lead, generatedAt, options?.organizationId) : null
    const tier = resolveWorkItemTier(item, signals)
    return buildOrderingRow({
      id: item.id,
      leadId: lead?.id ?? null,
      tier: capacity.killSwitchActive && tier !== "customer_reply_interrupt" ? "background_improvement" : tier,
      signals,
      decisionScoreTiebreak: item.decision_score,
      spendAuthorized: signals?.spendAuthorizedForResearch ?? false,
    })
  })

  const ordered = prioritizeMissionBalanceRows(rows)
  const byId = new Map(items.map((item) => [item.id, item]))
  const sorted = ordered.map((row) => byId.get(row.id)).filter((item): item is AvaWorkItem => item != null)

  if (capacity.maxAutonomousCandidates == null) return sorted

  let autonomousCount = 0
  const capped: AvaWorkItem[] = []
  for (const item of sorted) {
    if (item.can_execute_autonomously && item.type !== "reply") {
      autonomousCount += 1
      if (autonomousCount > capacity.maxAutonomousCandidates) continue
    }
    capped.push(item)
  }
  for (const item of items) {
    if (!capped.some((row) => row.id === item.id)) capped.push(item)
  }
  return capped
}

export function applyMissionBalanceToRevenueQueueCards(
  cards: RevenueQueueCardView[],
  leads: GrowthLead[],
  options?: {
    generatedAt?: string
    organizationId?: string
  },
): RevenueQueueCardView[] {
  const generatedAt = options?.generatedAt ?? new Date().toISOString()
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
  const rows = cards.map((card) => {
    const lead = leadsById.get(card.id)
    const signals = lead ? buildMissionBalanceLeadSignals(lead, generatedAt, options?.organizationId) : null
    const tier = signals ? resolveRevenueQueueTier(signals) : "background_improvement"
    return buildOrderingRow({
      id: card.id,
      leadId: card.id,
      tier,
      signals,
      decisionScoreTiebreak: card.intent_score ?? 0,
      spendAuthorized: signals?.spendAuthorizedForResearch ?? false,
    })
  })

  const ordered = prioritizeMissionBalanceRows(rows)
  const byId = new Map(cards.map((card) => [card.id, card]))
  return ordered.map((row) => byId.get(row.id)).filter((card): card is RevenueQueueCardView => card != null)
}

export function buildMissionBalanceReadModel(input: {
  workItems?: AvaWorkItem[]
  revenueQueueCards?: RevenueQueueCardView[]
  leads: GrowthLead[]
  generatedAt?: string
  organizationId?: string
  capacity?: Partial<GrowthMissionBalanceCapacityConstraints>
}): GrowthMissionBalanceReadModel {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const leadsById = new Map(input.leads.map((lead) => [lead.id, lead]))
  const capacity = { ...DEFAULT_CAPACITY, ...(input.capacity ?? {}) }

  const rows: GrowthMissionBalanceOrderingRow[] = []

  for (const item of input.workItems ?? []) {
    const lead = leadsById.get(item.decision_source_id) ?? null
    const signals = lead ? buildMissionBalanceLeadSignals(lead, generatedAt, input.organizationId) : null
    rows.push(
      buildOrderingRow({
        id: item.id,
        leadId: lead?.id ?? null,
        tier: resolveWorkItemTier(item, signals),
        signals,
        decisionScoreTiebreak: item.decision_score,
        spendAuthorized: signals?.spendAuthorizedForResearch ?? false,
      }),
    )
  }

  for (const card of input.revenueQueueCards ?? []) {
    const lead = leadsById.get(card.id) ?? null
    const signals = lead ? buildMissionBalanceLeadSignals(lead, generatedAt, input.organizationId) : null
    rows.push(
      buildOrderingRow({
        id: `queue:${card.id}`,
        leadId: card.id,
        tier: signals ? resolveRevenueQueueTier(signals) : "background_improvement",
        signals,
        decisionScoreTiebreak: card.intent_score ?? 0,
        spendAuthorized: signals?.spendAuthorizedForResearch ?? false,
      }),
    )
  }

  const ordered = prioritizeMissionBalanceRows(rows)
  return {
    qaMarker: GROWTH_MISSION_BALANCE_1A_QA_MARKER,
    rule: GROWTH_MISSION_BALANCE_1A_RULE,
    generatedAt,
    capacity,
    orderedIds: ordered.map((row) => row.id),
    rows: ordered,
    authorityChain: AUTHORITY_CHAIN,
  }
}

export {
  GROWTH_MISSION_BALANCE_1A_QA_MARKER,
  GROWTH_MISSION_BALANCE_1A_RULE,
  GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS,
  GROWTH_MISSION_BALANCE_PRIORITY_TIERS,
  GROWTH_MISSION_BALANCE_TIER_RANK,
} from "@/lib/growth/mission-balance/growth-mission-balance-1a-types"
