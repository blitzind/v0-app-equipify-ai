/**
 * GE-AIOS-AUTONOMY-1B/1C/1E — Draft Factory due/capacity sub-tick for Objective Runtime Scheduler.
 * Extends existing cron tick — does not register a new Vercel cron.
 *
 * AUTONOMY-1C: due advances via SV1-1 + SV1-2 capacity-class buckets.
 * AUTONOMY-1E: classify full due pool + sample per class before SV1-1 so FIFO
 * cannot starve capacity-class discovery under the due-tick runtime budget.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { ensureGrowthAiEventBusInProcessSubscribers } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import {
  mapPortfolioCapacityClassToResourceClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import {
  GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
  planFairDueCapacityClassAdmission,
} from "@/lib/growth/draft-factory/draft-factory-due-fair-admission"
import { selectPortfolioAwareDueDraftFactoryStates } from "@/lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import {
  advanceDraftFactoryCapacityWake,
  getDeferredDraftFactoryStates,
  listDueDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { advanceDraftFactoryForLeadLive } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import {
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { planWakeEvaluationBatch } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import type { AiOsPortfolioCapacityClass } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { DuePortfolioSelectionCandidate } from "@/lib/growth/draft-factory/draft-factory-due-portfolio-selection"

export type DraftFactoryDueSchedulerTickResult = {
  qa_marker: typeof GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER
  organizations_attempted: number
  due_states_found: number
  due_advanced: number
  capacity_selected: number
  capacity_deferred: number
  failures: number
  skipped_reason: string | null
  portfolio_aware_selected?: number
  portfolio_aware_classes?: number
  due_tick_started_at?: string
  due_tick_runtime_ms?: number
  budget_exhausted_phase?: string | null
}

type BudgetPhase =
  | null
  | "classification"
  | "enrichment"
  | "advancement"
  | "capacity_wake"

async function projectInvestmentForDueLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  capacityClass: AiOsPortfolioCapacityClass,
): Promise<{
  investmentState: AiOsInvestmentState | null
  spendAuthorized: boolean
  companyName: string | null
  researchFresh: boolean | null
  researchStale: boolean | null
  enrichmentFailed: boolean
  enrichmentFailureReason: string | null
}> {
  try {
    const lead = await fetchGrowthLeadById(admin, leadId)
    if (!lead) {
      return {
        investmentState: "stop_investment",
        spendAuthorized: false,
        companyName: null,
        researchFresh: null,
        researchStale: null,
        enrichmentFailed: true,
        enrichmentFailureReason: "lead_not_found",
      }
    }

    const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
    const researchStale = lead.lastProspectResearchedAt
      ? isProspectResearchStale(lead.lastProspectResearchedAt)
      : true
    const researchFresh = hasUsableResearch && !researchStale

    const signals = buildResourceAllocationSignalsFromLead(lead, {
      budgetAvailable: true,
      killSwitchActive: false,
    })
    const resource = evaluateResourceAllocationFacade({
      organizationId,
      accountId: leadId,
      resourceClass: mapPortfolioCapacityClassToResourceClass(capacityClass),
      signals,
    })

    return {
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      companyName: lead.companyName,
      researchFresh,
      researchStale,
      enrichmentFailed: false,
      enrichmentFailureReason: null,
    }
  } catch (error) {
    return {
      investmentState: "stop_investment",
      spendAuthorized: false,
      companyName: null,
      researchFresh: null,
      researchStale: null,
      enrichmentFailed: true,
      enrichmentFailureReason:
        error instanceof Error ? error.message.slice(0, 160) : "enrichment_exception",
    }
  }
}

export async function tickDraftFactoryDueStatesForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
    /** AUTONOMY-1E — due-tick local clock. Prefer omitting so the tick starts fresh. */
    startedAt?: number
    maxRuntimeMs?: number
    maxOrganizations?: number
  },
): Promise<DraftFactoryDueSchedulerTickResult> {
  ensureGrowthAiEventBusInProcessSubscribers()

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled) {
    return {
      qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
      organizations_attempted: 0,
      due_states_found: 0,
      due_advanced: 0,
      capacity_selected: 0,
      capacity_deferred: 0,
      failures: 0,
      skipped_reason: "Draft Factory due tick disabled by autonomy kill switch.",
    }
  }

  // AUTONOMY-1E — due-tick clock starts here (not shared with sales-loop start).
  const startedAt = input.startedAt ?? Date.now()
  const dueTickStartedAtIso = new Date(startedAt).toISOString()
  const maxRuntimeMs = input.maxRuntimeMs ?? 15_000
  const maxOrgs = input.maxOrganizations ?? GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS
  const organizationIds = [...new Set(input.organizationIds)].slice(0, maxOrgs)

  let dueStatesFound = 0
  let dueAdvanced = 0
  let capacitySelected = 0
  let capacityDeferred = 0
  let failures = 0
  let portfolioAwareSelected = 0
  let portfolioAwareClasses = 0
  let budgetExhaustedPhase: BudgetPhase = null

  for (const organizationId of organizationIds) {
    if (Date.now() - startedAt >= maxRuntimeMs) {
      budgetExhaustedPhase = budgetExhaustedPhase ?? "advancement"
      break
    }

    try {
      const resolved = await resolveDraftFactoryDurableRepository({
        runtime: "production",
        admin,
      })
      if (resolved.kind !== "postgres") {
        failures += 1
        continue
      }
      const repository = resolved.repository
      const now = new Date().toISOString()

      const dueStates = await listDueDraftFactoryStates({
        organizationId,
        now,
        limit: GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
        repository,
      })
      dueStatesFound += dueStates.length

      // GE-AIOS-CONTACT-1B — resume pending DataMoon DM discovery polls (no new cron).
      try {
        const { pollDueDatamoonDmDiscoveriesForOrganization } = await import(
          "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-poll-tick"
        )
        await pollDueDatamoonDmDiscoveriesForOrganization(admin, {
          organizationId,
          now,
          limit: 10,
          portfolioSelected: true,
        })
      } catch {
        // Poll tick must not abort DF due advances.
      }

      // AUTONOMY-1E — eager class discovery from the full due pool (pure, no SV1-1).
      const admission = planFairDueCapacityClassAdmission({
        dueStates: dueStates.map((state) => ({
          leadId: state.leadId,
          state: state.state,
          updatedAt: state.updatedAt,
        })),
        totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
        perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
      })

      const enriched: DuePortfolioSelectionCandidate[] = []
      const enrichedCountByClass: Record<string, number> = {}
      let enrichmentFailureCount = 0
      let enrichmentBudgetExhausted = false

      for (const candidate of admission.sampledCandidates) {
        if (Date.now() - startedAt >= maxRuntimeMs) {
          enrichmentBudgetExhausted = true
          budgetExhaustedPhase = "enrichment"
          break
        }

        const investment = await projectInvestmentForDueLead(
          admin,
          organizationId,
          candidate.leadId,
          candidate.capacityClass,
        )

        if (investment.enrichmentFailed) {
          enrichmentFailureCount += 1
          logGrowthEngine("draft_factory_due_enrichment_failed", {
            qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
            organization_id: organizationId,
            lead_id: candidate.leadId,
            capacity_class: candidate.capacityClass,
            reason: investment.enrichmentFailureReason,
          })
          // Fail closed for this lead — still include stop so SV1-2 can skip consistently.
        }

        enriched.push({
          leadId: candidate.leadId,
          state: candidate.state,
          updatedAt: candidate.updatedAt,
          investmentState: investment.investmentState,
          spendAuthorized: investment.spendAuthorized,
          companyName: investment.companyName,
          researchFresh: investment.researchFresh,
          researchStale: investment.researchStale,
        })
        enrichedCountByClass[candidate.capacityClass] =
          (enrichedCountByClass[candidate.capacityClass] ?? 0) + 1
      }

      // Portfolio selection runs on whatever was enriched; discovered classes already logged.
      const selection = selectPortfolioAwareDueDraftFactoryStates({
        organizationId,
        dueStates: enriched,
        totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
        perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
        decidedAt: now,
      })
      portfolioAwareSelected += selection.selectedLeadIds.length
      portfolioAwareClasses += selection.classSelections.length

      const selectedCountByClass: Record<string, number> = {}
      for (const row of selection.classSelections) {
        selectedCountByClass[row.capacityClass] = row.selectedLeadIds.length
      }

      logGrowthEngine("draft_factory_due_portfolio_selection", {
        qa_marker: selection.qa_marker,
        autonomy_1e_qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
        organization_id: organizationId,
        due_pool: dueStates.length,
        due_pool_count: admission.duePoolCount,
        selected: selection.selectedLeadIds.length,
        active_capacity_classes: admission.activeCapacityClasses,
        raw_count_by_class: admission.rawCountByClass,
        candidate_cap_by_class: admission.candidateCapByClass,
        sampled_count_by_class: admission.sampledCountByClass,
        enriched_count_by_class: enrichedCountByClass,
        selected_count_by_class: selectedCountByClass,
        skipped_stop_count: selection.classSelections.reduce(
          (sum, row) => sum + row.skippedStopInvestment,
          0,
        ),
        enrichment_failure_count: enrichmentFailureCount,
        budget_exhausted_phase: enrichmentBudgetExhausted ? "enrichment" : null,
        due_tick_started_at: dueTickStartedAtIso,
        classes: selection.classSelections.map((row) => ({
          capacity_class: row.capacityClass,
          slots: row.slotsAllocated,
          candidates: row.candidateCount,
          selected: row.selectedLeadIds.length,
          stop_skipped: row.skippedStopInvestment,
        })),
      })

      for (const leadId of selection.selectedLeadIds) {
        const capacityClass = selection.selectedByClass[leadId]
        const candidate = enriched.find((row) => row.leadId === leadId)
        logGrowthEngine("draft_factory_due_lead_selection_explain", {
          qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
          organization_id: organizationId,
          lead_id: leadId,
          capacity_class: capacityClass ?? null,
          sampled: true,
          investment: candidate?.investmentState ?? null,
          portfolio: "selected",
          advanced: false,
          reason: "portfolio_selected_pending_advance",
        })
      }

      const dueBatch = planWakeEvaluationBatch({
        totalWaits: selection.selectedLeadIds.length,
        perRunCap: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
      })

      if (dueBatch.wakeExecutionEnabled && dueBatch.effectiveLimit > 0) {
        for (const leadId of selection.selectedLeadIds.slice(0, dueBatch.effectiveLimit)) {
          if (Date.now() - startedAt >= maxRuntimeMs) {
            budgetExhaustedPhase = "advancement"
            break
          }
          const capacityClass = selection.selectedByClass[leadId]
          const candidate = enriched.find((row) => row.leadId === leadId)
          const result = await advanceDraftFactoryForLeadLive(admin, {
            organizationId,
            leadId,
            wake: {
              type: "scheduled_resume",
              sourceId: `due:${organizationId}:${leadId}:${now}:${capacityClass ?? "unknown"}`,
            },
            portfolioSelected: true,
            allowGeneration: false,
            workerId: `df-due-scheduler:${organizationId}`,
          })
          const advanced = result.outcome !== "duplicate_noop"
          if (advanced) dueAdvanced += 1
          logGrowthEngine("draft_factory_due_lead_selection_explain", {
            qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
            organization_id: organizationId,
            lead_id: leadId,
            capacity_class: capacityClass ?? null,
            sampled: true,
            investment: candidate?.investmentState ?? null,
            portfolio: "selected",
            advanced,
            reason: advanced ? "advanced" : "duplicate_noop",
            outcome: result.outcome,
          })
        }
      }

      const deferred = await getDeferredDraftFactoryStates(organizationId, repository)
      const capacityCandidates = deferred.slice(0, GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG)
      const capacityBatch = planWakeEvaluationBatch({
        totalWaits: capacityCandidates.length,
        perRunCap: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
      })

      if (capacityBatch.wakeExecutionEnabled && capacityBatch.effectiveLimit > 0 && capacityCandidates.length > 0) {
        const capacityEnriched = []
        for (const [index, row] of capacityCandidates.entries()) {
          if (Date.now() - startedAt >= maxRuntimeMs) {
            budgetExhaustedPhase = budgetExhaustedPhase ?? "capacity_wake"
            break
          }
          const investment = await projectInvestmentForDueLead(
            admin,
            organizationId,
            row.leadId,
            "llm_drafting",
          )
          capacityEnriched.push({
            leadId: row.leadId,
            investmentState: (investment.investmentState ?? "maintain_investment") as AiOsInvestmentState,
            spendAuthorized: investment.spendAuthorized,
            signals: {
              missionPriorityOverall: 100 - index,
              priorityBindingRank: index + 1,
            },
          })
        }

        if (capacityEnriched.length > 0) {
          const capacity = await advanceDraftFactoryCapacityWake({
            organizationId,
            capacityClass: "llm_drafting",
            capacitySlotsAvailable: capacityBatch.effectiveLimit,
            now,
            workerId: `df-capacity-scheduler:${organizationId}`,
            repository,
            candidates: capacityEnriched,
          })
          capacitySelected += capacity.selectedLeadIds.length
          capacityDeferred += capacity.deferredLeadIds.length
        }
      }
    } catch (error) {
      failures += 1
      logGrowthEngine("draft_factory_due_scheduler_org_failed", {
        qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
        organization_id: organizationId,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  const dueTickRuntimeMs = Date.now() - startedAt
  logGrowthEngine("draft_factory_due_scheduler_tick", {
    qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
    autonomy_1e_qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
    organizations_attempted: organizationIds.length,
    due_states_found: dueStatesFound,
    due_advanced: dueAdvanced,
    capacity_selected: capacitySelected,
    capacity_deferred: capacityDeferred,
    portfolio_aware_selected: portfolioAwareSelected,
    portfolio_aware_classes: portfolioAwareClasses,
    failures,
    due_tick_started_at: dueTickStartedAtIso,
    due_tick_runtime_ms: dueTickRuntimeMs,
    budget_exhausted_phase: budgetExhaustedPhase,
    runtime_ms: dueTickRuntimeMs,
  })

  return {
    qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
    organizations_attempted: organizationIds.length,
    due_states_found: dueStatesFound,
    due_advanced: dueAdvanced,
    capacity_selected: capacitySelected,
    capacity_deferred: capacityDeferred,
    failures,
    skipped_reason: null,
    portfolio_aware_selected: portfolioAwareSelected,
    portfolio_aware_classes: portfolioAwareClasses,
    due_tick_started_at: dueTickStartedAtIso,
    due_tick_runtime_ms: dueTickRuntimeMs,
    budget_exhausted_phase: budgetExhaustedPhase,
  }
}
