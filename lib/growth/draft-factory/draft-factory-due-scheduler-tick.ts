/**
 * GE-AIOS-AUTONOMY-1B — Draft Factory due/capacity sub-tick for Objective Runtime Scheduler.
 * Extends existing cron tick — does not register a new Vercel cron.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { ensureGrowthAiEventBusInProcessSubscribers } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import {
  advanceDraftFactoryCapacityWake,
  getDeferredDraftFactoryStates,
  listDueDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { advanceDraftFactoryForLeadLive } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import {
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { planWakeEvaluationBatch } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type DraftFactoryDueSchedulerTickResult = {
  qa_marker: typeof GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER
  organizations_attempted: number
  due_states_found: number
  due_advanced: number
  capacity_selected: number
  capacity_deferred: number
  failures: number
  skipped_reason: string | null
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

      const dueStates = await listDueDraftFactoryStates({
        organizationId,
        now,
        limit: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
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

      const dueBatch = planWakeEvaluationBatch({
        totalWaits: dueStates.length,
        perRunCap: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
      })

      if (dueBatch.wakeExecutionEnabled && dueBatch.effectiveLimit > 0) {
        for (const state of dueStates.slice(0, dueBatch.effectiveLimit)) {
          if (Date.now() - startedAt >= maxRuntimeMs) break
          const result = await advanceDraftFactoryForLeadLive(admin, {
            organizationId,
            leadId: state.leadId,
            wake: {
              type: "scheduled_resume",
              sourceId: `due:${organizationId}:${state.leadId}:${now}`,
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
        const capacity = await advanceDraftFactoryCapacityWake({
          organizationId,
          capacityClass: "llm_drafting",
          capacitySlotsAvailable: capacityBatch.effectiveLimit,
          now,
          workerId: `df-capacity-scheduler:${organizationId}`,
          repository,
          candidates: capacityCandidates.map((row, index) => ({
            leadId: row.leadId,
            investmentState: "maintain_investment" as const,
            spendAuthorized: true,
            signals: { missionPriorityOverall: 100 - index },
          })),
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
  }
}
