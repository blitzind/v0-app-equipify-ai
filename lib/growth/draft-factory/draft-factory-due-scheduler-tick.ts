/**
 * GE-AIOS-AUTONOMY-1B/1C — Draft Factory due/capacity sub-tick for Objective Runtime Scheduler.
 * Extends existing cron tick — does not register a new Vercel cron.
 *
 * AUTONOMY-1C: due advances are selected via SV1-1 + SV1-2 capacity-class buckets.
 * FIFO (`updated_at ASC`) is only the final tie-break — not the sole authority.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { ensureGrowthAiEventBusInProcessSubscribers } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import {
  mapDurableStateToPortfolioCapacityClass,
  mapPortfolioCapacityClassToResourceClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
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
}

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
}> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) {
    return {
      investmentState: "stop_investment",
      spendAuthorized: false,
      companyName: null,
      researchFresh: null,
      researchStale: null,
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
  }
}

export async function tickDraftFactoryDueStatesForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
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

  const startedAt = input.startedAt ?? Date.now()
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

  for (const organizationId of organizationIds) {
    if (Date.now() - startedAt >= maxRuntimeMs) break

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

      // AUTONOMY-1C — pull a larger due pool; portfolio-aware selection chooses the advance set.
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

      const enriched = []
      for (const state of dueStates) {
        if (Date.now() - startedAt >= maxRuntimeMs) break
        const capacityClass = mapDurableStateToPortfolioCapacityClass(state.state)
        if (!capacityClass) continue
        const investment = await projectInvestmentForDueLead(
          admin,
          organizationId,
          state.leadId,
          capacityClass,
        )
        enriched.push({
          leadId: state.leadId,
          state: state.state,
          updatedAt: state.updatedAt,
          investmentState: investment.investmentState,
          spendAuthorized: investment.spendAuthorized,
          companyName: investment.companyName,
          researchFresh: investment.researchFresh,
          researchStale: investment.researchStale,
        })
      }

      const selection = selectPortfolioAwareDueDraftFactoryStates({
        organizationId,
        dueStates: enriched,
        totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
        perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
        decidedAt: now,
      })
      portfolioAwareSelected += selection.selectedLeadIds.length
      portfolioAwareClasses += selection.classSelections.length

      logGrowthEngine("draft_factory_due_portfolio_selection", {
        qa_marker: selection.qa_marker,
        organization_id: organizationId,
        due_pool: dueStates.length,
        selected: selection.selectedLeadIds.length,
        classes: selection.classSelections.map((row) => ({
          capacity_class: row.capacityClass,
          slots: row.slotsAllocated,
          candidates: row.candidateCount,
          selected: row.selectedLeadIds.length,
          stop_skipped: row.skippedStopInvestment,
        })),
      })

      const dueBatch = planWakeEvaluationBatch({
        totalWaits: selection.selectedLeadIds.length,
        perRunCap: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
      })

      if (dueBatch.wakeExecutionEnabled && dueBatch.effectiveLimit > 0) {
        for (const leadId of selection.selectedLeadIds.slice(0, dueBatch.effectiveLimit)) {
          if (Date.now() - startedAt >= maxRuntimeMs) break
          const capacityClass = selection.selectedByClass[leadId]
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
          if (result.outcome !== "duplicate_noop") dueAdvanced += 1
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
          if (Date.now() - startedAt >= maxRuntimeMs) break
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
    } catch (error) {
      failures += 1
      logGrowthEngine("draft_factory_due_scheduler_org_failed", {
        qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
        organization_id: organizationId,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  logGrowthEngine("draft_factory_due_scheduler_tick", {
    qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
    organizations_attempted: organizationIds.length,
    due_states_found: dueStatesFound,
    due_advanced: dueAdvanced,
    capacity_selected: capacitySelected,
    capacity_deferred: capacityDeferred,
    portfolio_aware_selected: portfolioAwareSelected,
    portfolio_aware_classes: portfolioAwareClasses,
    failures,
    runtime_ms: Date.now() - startedAt,
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
  }
}
