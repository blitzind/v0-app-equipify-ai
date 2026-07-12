/**
 * SV1-2 / ARCH-2A — Portfolio Allocation Facade engine (client-safe).
 * Composes existing ranker outputs. Does not invent a new prioritization engine.
 */

import { AI_OS_INVESTMENT_STATES, type AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import {
  AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE,
  AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
  AI_OS_PORTFOLIO_CAPACITY_CLASSES,
  AI_OS_PORTFOLIO_CAPACITY_COST,
  AI_OS_PORTFOLIO_RANKER_AUTHORITY,
  AI_OS_PORTFOLIO_STATES,
  type AiOsPortfolioAllocationCycleResult,
  type AiOsPortfolioAllocationRequest,
  type AiOsPortfolioCandidate,
  type AiOsPortfolioCapacityClass,
  type AiOsPortfolioDecision,
  type AiOsPortfolioState,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function isKnownCapacityClass(value: string): value is AiOsPortfolioCapacityClass {
  return (AI_OS_PORTFOLIO_CAPACITY_CLASSES as readonly string[]).includes(value)
}

function isKnownInvestmentState(value: string): value is AiOsInvestmentState {
  return (AI_OS_INVESTMENT_STATES as readonly string[]).includes(value)
}

function isKnownPortfolioState(value: string): value is AiOsPortfolioState {
  return (AI_OS_PORTFOLIO_STATES as readonly string[]).includes(value)
}

export type PortfolioEligibility =
  | { eligible: true; track: "scarce" | "inexpensive" | "existing"; reason: string }
  | { eligible: false; portfolioState: AiOsPortfolioState; reason: string; cause: string }

/**
 * ARCH-1A gate before portfolio ranking.
 * Stop never receives an active slot. Missing investment decision fails closed for scarce capacity.
 */
export function evaluatePortfolioEligibility(
  candidate: AiOsPortfolioCandidate,
  capacityClass: AiOsPortfolioCapacityClass,
): PortfolioEligibility {
  const cost = AI_OS_PORTFOLIO_CAPACITY_COST[capacityClass]
  const investment = candidate.investmentState

  if (candidate.signals?.killSwitchActive === true) {
    return {
      eligible: false,
      portfolioState: "paused",
      reason: "Kill switch active — excluded from portfolio capacity.",
      cause: "investment_state",
    }
  }

  if (candidate.signals?.paused === true) {
    return {
      eligible: false,
      portfolioState: "paused",
      reason: "Account paused — excluded from portfolio capacity.",
      cause: "investment_state",
    }
  }

  if (candidate.signals?.completed === true) {
    return {
      eligible: false,
      portfolioState: "completed",
      reason: "Work already completed for this capacity class.",
      cause: "completed",
    }
  }

  if (!investment || !isKnownInvestmentState(investment)) {
    if (cost === "scarce" || cost === "outbound") {
      return {
        eligible: false,
        portfolioState: "deferred",
        reason:
          "No SV1-1 Resource Allocation decision — fail closed for scarce capacity (shadow projection only).",
        cause: "investment_state",
      }
    }
    // Inexpensive validation may proceed under pending-like treatment when decision missing.
    return {
      eligible: true,
      track: "inexpensive",
      reason: "Missing investment decision — inexpensive capacity only (fail-soft for cheap validation).",
    }
  }

  if (investment === "stop_investment") {
    return {
      eligible: false,
      portfolioState: "archived",
      reason: "Stop Investment — portfolio must never override ARCH-1A stop.",
      cause: "investment_state",
    }
  }

  if (investment === "reduce_investment") {
    return {
      eligible: false,
      portfolioState: "monitoring",
      reason: "Reduce Investment — excluded from active scarce allocation.",
      cause: "investment_state",
    }
  }

  if (investment === "pending_investment") {
    if (cost === "inexpensive") {
      return {
        eligible: true,
        track: "inexpensive",
        reason: "Pending Investment — eligible only for inexpensive validation capacity.",
      }
    }
    return {
      eligible: false,
      portfolioState: "deferred",
      reason: "Pending Investment — not eligible for scarce/outbound capacity until validated.",
      cause: "investment_state",
    }
  }

  if (investment === "maintain_investment") {
    if (cost === "inexpensive") {
      return {
        eligible: true,
        track: "existing",
        reason: "Maintain Investment — eligible for existing-track / inexpensive capacity only.",
      }
    }
    return {
      eligible: false,
      portfolioState: "monitoring",
      reason: "Maintain Investment — not competing for additional scarce capacity.",
      cause: "investment_state",
    }
  }

  // increase_investment
  if (cost === "outbound") {
    // Still rank for explainability, but selection for outbound remains approval-gated externally.
    return {
      eligible: true,
      track: "scarce",
      reason: "Increase Investment — eligible to compete; outbound send stays separately gated.",
    }
  }

  return {
    eligible: true,
    track: cost === "inexpensive" ? "inexpensive" : "scarce",
    reason: "Increase Investment — eligible for scarce-capacity competition.",
  }
}

/**
 * Compose existing ranker outputs into a deterministic priority score.
 * Does not reimplement 4F / Meta / Daily Queue scoring — only uses their published scores.
 *
 * Authority order mirrors Priority Engine Binding:
 * primary = 4F overallPriority; secondary = meta/binding; tertiary = daily queue; tie-break = leadId.
 */
export function composePortfolioPriorityScore(candidate: AiOsPortfolioCandidate): {
  score: number
  composition: string
  boosts: string[]
} {
  const signals = candidate.signals ?? {}
  const boosts: string[] = []

  const mission = clampScore(
    typeof signals.missionPriorityOverall === "number" ? signals.missionPriorityOverall : 0,
  )
  const binding =
    typeof signals.priorityBindingScore === "number"
      ? clampScore(signals.priorityBindingScore)
      : typeof signals.metaRecommendationScore === "number"
        ? clampScore(signals.metaRecommendationScore)
        : 0
  const daily =
    typeof signals.dailyQueueSortScore === "number"
      ? clampScore(signals.dailyQueueSortScore > 100 ? signals.dailyQueueSortScore / 10 : signals.dailyQueueSortScore)
      : 0

  // Weighted composition mirrors binding formula spirit without inventing new dimensions.
  // Primary weight on 4F; secondary on meta/binding; tertiary on daily queue context.
  let score = mission * 0.7 + binding * 0.2 + daily * 0.1

  if (signals.missionAligned === true) {
    score += 3
    boosts.push("mission_aligned")
  } else if (signals.missionAligned === false) {
    score -= 8
    boosts.push("mission_misaligned_penalty")
  }

  if (signals.researchStale === true) {
    score += 2
    boosts.push("stale_research_urgency")
  }
  if (signals.researchFresh === true && mission > 0) {
    // Fresh research slightly lowers research urgency but does not invent scores.
    score -= 1
    boosts.push("fresh_research_deprioritize_research")
  }

  if (typeof signals.engagementScore === "number" && signals.engagementScore >= 60) {
    score += 2
    boosts.push("engaged_lead")
  } else if (typeof signals.engagementScore === "number" && signals.engagementScore <= 10) {
    boosts.push("untouched_or_low_engagement")
  }

  if (typeof signals.urgencyScore === "number" && signals.urgencyScore >= 70) {
    score += 2
    boosts.push("high_urgency_signal")
  }

  if (typeof signals.opportunityValue === "number" && signals.opportunityValue >= 70) {
    score += 2
    boosts.push("high_opportunity_value")
  }

  if (typeof signals.priorityBindingRank === "number" && signals.priorityBindingRank > 0) {
    // Better binding rank (lower number) slightly boosts — uses existing binding authority.
    score += Math.max(0, 5 - Math.min(5, signals.priorityBindingRank - 1))
    boosts.push(`priority_binding_rank_${signals.priorityBindingRank}`)
  }

  const composition = [
    `4F overallPriority=${mission} (${AI_OS_PORTFOLIO_RANKER_AUTHORITY.missionPriority4f})`,
    `meta/binding=${binding} (${AI_OS_PORTFOLIO_RANKER_AUTHORITY.metaOrPriorityBinding})`,
    `dailyQueue=${daily} (${AI_OS_PORTFOLIO_RANKER_AUTHORITY.dailyRevenueQueue})`,
    boosts.length ? `signal_adjustments=[${boosts.join(",")}]` : "signal_adjustments=[]",
  ].join("; ")

  return { score: clampScore(score), composition, boosts }
}

function compareCandidates(
  a: { leadId: string; score: number; bindingRank: number },
  b: { leadId: string; score: number; bindingRank: number },
): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.bindingRank !== b.bindingRank) return a.bindingRank - b.bindingRank
  return a.leadId.localeCompare(b.leadId)
}

function projectSelectedState(rank: number): AiOsPortfolioState {
  return rank === 1 ? "highest_priority" : "active_investment"
}

function projectDeferredEligibleState(rankAmongEligible: number, slots: number): AiOsPortfolioState {
  if (rankAmongEligible <= slots * 2) return "queued"
  return "deferred"
}

export function evaluatePortfolioAllocationFacade(
  request: AiOsPortfolioAllocationRequest,
): AiOsPortfolioAllocationCycleResult {
  const mode = request.mode ?? AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE
  const decidedAt = request.decidedAt ?? new Date().toISOString()
  const existingSelectedLeadIds = [...new Set(request.existingSelectedLeadIds ?? [])]
  const capacityClass = isKnownCapacityClass(request.capacityClass)
    ? request.capacityClass
    : null

  if (!request.organizationId?.trim() || !capacityClass) {
    return {
      qaMarker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
      organizationId: request.organizationId ?? "",
      capacityClass: (capacityClass ?? "website_research") as AiOsPortfolioCapacityClass,
      capacitySlotsAvailable: 0,
      capacitySlotsFilled: 0,
      mode: "shadow",
      enforcement_applied: false,
      decided_at: decidedAt,
      decisions: [],
      selectedLeadIds: [],
      deferredLeadIds: [],
      existingSelectedLeadIds,
      overlapLeadIds: [],
      mismatch: {
        facadeOnly: [],
        existingOnly: existingSelectedLeadIds,
        reasons: ["Malformed portfolio request — fail safe with empty selection."],
      },
    }
  }

  const slots = Math.max(0, Math.floor(request.capacitySlotsAvailable))
  const cost = AI_OS_PORTFOLIO_CAPACITY_COST[capacityClass]

  // Deduplicate candidates — first occurrence wins; later duplicates never get a second slot.
  const seen = new Set<string>()
  const uniqueCandidates: AiOsPortfolioCandidate[] = []
  for (const candidate of request.candidates ?? []) {
    const leadId = candidate.leadId?.trim()
    if (!leadId) continue
    if (seen.has(leadId)) continue
    seen.add(leadId)
    uniqueCandidates.push({ ...candidate, leadId, organizationId: request.organizationId })
  }

  const competingCount = uniqueCandidates.length
  type Ranked = {
    candidate: AiOsPortfolioCandidate
    eligibility: PortfolioEligibility
    score: number
    composition: string
    boosts: string[]
    bindingRank: number
  }

  const ranked: Ranked[] = uniqueCandidates.map((candidate) => {
    const eligibility = evaluatePortfolioEligibility(candidate, capacityClass)
    const composed = composePortfolioPriorityScore(candidate)
    const bindingRank =
      typeof candidate.signals?.priorityBindingRank === "number" &&
      candidate.signals.priorityBindingRank > 0
        ? candidate.signals.priorityBindingRank
        : Number.MAX_SAFE_INTEGER
    return {
      candidate,
      eligibility,
      score: composed.score,
      composition: composed.composition,
      boosts: composed.boosts,
      bindingRank,
    }
  })

  const eligible = ranked
    .filter((row) => row.eligibility.eligible)
    .sort((a, b) =>
      compareCandidates(
        { leadId: a.candidate.leadId, score: a.score, bindingRank: a.bindingRank },
        { leadId: b.candidate.leadId, score: b.score, bindingRank: b.bindingRank },
      ),
    )

  const selectedIds = new Set(eligible.slice(0, slots).map((row) => row.candidate.leadId))
  const eligibleRank = new Map(eligible.map((row, index) => [row.candidate.leadId, index + 1]))

  const decisions: AiOsPortfolioDecision[] = ranked
    .slice()
    .sort((a, b) =>
      compareCandidates(
        { leadId: a.candidate.leadId, score: a.score, bindingRank: a.bindingRank },
        { leadId: b.candidate.leadId, score: b.score, bindingRank: b.bindingRank },
      ),
    )
    .map((row) => {
      const investmentState: AiOsInvestmentState | "unknown" =
        row.candidate.investmentState && isKnownInvestmentState(row.candidate.investmentState)
          ? row.candidate.investmentState
          : "unknown"

      if (!row.eligibility.eligible) {
        const portfolioState = row.eligibility.portfolioState
        return {
          lead_id: row.candidate.leadId,
          organization_id: request.organizationId,
          mission_id: row.candidate.missionId ?? null,
          objective_id: row.candidate.objectiveId ?? null,
          investment_state: investmentState,
          portfolio_state: isKnownPortfolioState(portfolioState) ? portfolioState : "deferred",
          selected: false,
          rank: null,
          priority_score: row.score,
          capacity_class: capacityClass,
          capacity_slot: null,
          reason: row.eligibility.reason,
          selected_because: null,
          deferred_because: `${row.eligibility.cause}: ${row.eligibility.reason}`,
          supporting_signals: {
            ...(row.candidate.signals ?? {}),
            eligibility: row.eligibility.reason,
            composition: row.composition,
          },
          competing_account_count: competingCount,
          estimated_capacity_cost: cost,
          mode: "shadow",
          enforcement_applied: false,
          decided_at: decidedAt,
          qa_marker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
        } satisfies AiOsPortfolioDecision
      }

      const rank = eligibleRank.get(row.candidate.leadId) ?? null
      const selected = selectedIds.has(row.candidate.leadId)
      const slot = selected && rank != null ? rank : null

      if (selected && rank != null) {
        const displaced = eligible[rank] // next eligible after this one (0-index: rank is 1-based)
        const beat =
          displaced && rank <= slots
            ? `Outranked lead ${displaced.candidate.leadId} (score ${row.score.toFixed(1)} > ${displaced.score.toFixed(1)}) for ${capacityClass}.`
            : `Within top ${slots} eligible accounts for ${capacityClass}.`

        const selectedBecause = [
          row.eligibility.reason,
          `Ranked #${rank} of ${eligible.length} eligible (composed priority ${row.score.toFixed(1)}).`,
          row.candidate.missionId
            ? `Supports mission ${row.candidate.missionId}.`
            : "No mission attached — ranked on available 4F/meta/queue signals only.",
          `Competing for capacity class ${capacityClass}.`,
          row.boosts.length
            ? `Signals that increased priority: ${row.boosts.join(", ")}.`
            : "No additional signal boosts.",
          beat,
        ].join(" ")

        return {
          lead_id: row.candidate.leadId,
          organization_id: request.organizationId,
          mission_id: row.candidate.missionId ?? null,
          objective_id: row.candidate.objectiveId ?? null,
          investment_state: investmentState,
          portfolio_state: projectSelectedState(rank),
          selected: true,
          rank,
          priority_score: row.score,
          capacity_class: capacityClass,
          capacity_slot: slot,
          reason: selectedBecause,
          selected_because: selectedBecause,
          deferred_because: null,
          supporting_signals: {
            ...(row.candidate.signals ?? {}),
            eligibility: row.eligibility.reason,
            composition: row.composition,
          },
          competing_account_count: competingCount,
          estimated_capacity_cost: cost,
          mode: "shadow",
          enforcement_applied: false,
          decided_at: decidedAt,
          qa_marker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
        } satisfies AiOsPortfolioDecision
      }

      const cause =
        slots <= 0
          ? "capacity"
          : row.candidate.signals?.missionAligned === false
            ? "mission_alignment"
            : "lower_expected_value"

      const reconsider =
        cause === "capacity"
          ? "Reconsider when capacity slots free or higher-ranked accounts complete."
          : cause === "mission_alignment"
            ? "Reconsider when mission alignment is restored or a higher-priority mission binds."
            : "Reconsider when 4F/meta/queue signals improve relative to peers, or capacity expands."

      const ahead = eligible
        .slice(0, Math.min(3, slots || 3))
        .map((peer) => `${peer.candidate.leadId}(${peer.score.toFixed(1)})`)
        .join(", ")

      const deferredBecause = [
        `${cause}: Eligible but not selected for ${capacityClass} (${slots} slot${slots === 1 ? "" : "s"}).`,
        rank != null
          ? `Ranked #${rank} of ${eligible.length} eligible with composed priority ${row.score.toFixed(1)}.`
          : `Composed priority ${row.score.toFixed(1)}.`,
        ahead
          ? `Higher-ranked accounts receiving capacity first: ${ahead}.`
          : "No higher-ranked peers in this cycle.",
        reconsider,
      ].join(" ")

      return {
        lead_id: row.candidate.leadId,
        organization_id: request.organizationId,
        mission_id: row.candidate.missionId ?? null,
        objective_id: row.candidate.objectiveId ?? null,
        investment_state: investmentState,
        portfolio_state: projectDeferredEligibleState(rank ?? 999, Math.max(slots, 1)),
        selected: false,
        rank,
        priority_score: row.score,
        capacity_class: capacityClass,
        capacity_slot: null,
        reason: deferredBecause,
        selected_because: null,
        deferred_because: deferredBecause,
        supporting_signals: {
          ...(row.candidate.signals ?? {}),
          eligibility: row.eligibility.reason,
          composition: row.composition,
        },
        competing_account_count: competingCount,
        estimated_capacity_cost: cost,
        mode: "shadow",
        enforcement_applied: false,
        decided_at: decidedAt,
        qa_marker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
      } satisfies AiOsPortfolioDecision
    })

  const selectedLeadIds = decisions.filter((d) => d.selected).map((d) => d.lead_id)
  const deferredLeadIds = decisions.filter((d) => !d.selected).map((d) => d.lead_id)
  const overlapLeadIds = selectedLeadIds.filter((id) => existingSelectedLeadIds.includes(id))
  const facadeOnly = selectedLeadIds.filter((id) => !existingSelectedLeadIds.includes(id))
  const existingOnly = existingSelectedLeadIds.filter((id) => !selectedLeadIds.includes(id))

  const mismatchReasons: string[] = []
  for (const id of facadeOnly) {
    const decision = decisions.find((d) => d.lead_id === id)
    mismatchReasons.push(
      `Facade selected ${id} but existing selector did not — ${decision?.selected_because ?? decision?.reason ?? "n/a"}`,
    )
  }
  for (const id of existingOnly) {
    const decision = decisions.find((d) => d.lead_id === id)
    mismatchReasons.push(
      `Existing selector chose ${id} but facade deferred — ${decision?.deferred_because ?? decision?.reason ?? "not in candidate set or ineligible"}`,
    )
  }

  return {
    qaMarker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
    organizationId: request.organizationId,
    capacityClass,
    capacitySlotsAvailable: slots,
    capacitySlotsFilled: selectedLeadIds.length,
    mode: "shadow",
    enforcement_applied: false,
    decided_at: decidedAt,
    decisions,
    selectedLeadIds,
    deferredLeadIds,
    existingSelectedLeadIds,
    overlapLeadIds,
    mismatch: {
      facadeOnly,
      existingOnly,
      reasons: mismatchReasons,
    },
  }
}

/** Build displacement notes answering why A outranked B. */
export function buildPortfolioDisplacementNotes(
  result: AiOsPortfolioAllocationCycleResult,
): string[] {
  const selected = result.decisions
    .filter((d) => d.selected)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const deferred = result.decisions.filter((d) => !d.selected && d.rank != null)
  const notes: string[] = []

  for (const top of selected.slice(0, 5)) {
    const beaten = deferred
      .filter((d) => (d.priority_score ?? 0) < top.priority_score)
      .slice(0, 2)
    for (const other of beaten) {
      notes.push(
        `${top.lead_id} outranked ${other.lead_id} for ${result.capacityClass}: score ${top.priority_score.toFixed(1)} > ${other.priority_score.toFixed(1)}; investment ${top.investment_state} vs ${other.investment_state}; mission ${top.mission_id ?? "none"} vs ${other.mission_id ?? "none"}.`,
      )
    }
  }

  return notes
}
