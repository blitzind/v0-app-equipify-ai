/**
 * GE-AIOS-AUTONOMY-1B — Draft Factory AI OS Event Bus observer (server-only).
 * Reuses wakeDraftFactoryFromCompletionEvent + capacity wake — no parallel engine.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  advanceDraftFactoryCapacityWake,
  getDeferredDraftFactoryStates,
  listDueDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import {
  buildCanonicalEvidenceForLead,
  wakeDraftFactoryFromCompletionEvent,
} from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { collectGenerationCapacityCandidates } from "@/lib/growth/draft-factory/draft-factory-generation-capacity"
import {
  mapAiOsEventToDraftFactoryWakePlans,
  type DraftFactoryWakePlan,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-mapper"
import {
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { planWakeEvaluationBatch } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export type DraftFactoryWakeObservationResult = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER
  subscriberId: typeof GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID
  observed: boolean
  plans: number
  advanced: number
  skipped: number
  reason: string | null
}

async function resolveLiveRepository(admin: SupabaseClient) {
  const resolved = await resolveDraftFactoryDurableRepository({
    runtime: "production",
    admin,
  })
  if (resolved.kind !== "postgres") {
    throw new Error(`Draft Factory wake observer requires postgres, got ${resolved.kind}`)
  }
  return resolved.repository
}

async function applyOrgCapacityWake(
  admin: SupabaseClient,
  input: { organizationId: string; sourceId: string; now: string },
): Promise<number> {
  const repository = await resolveLiveRepository(admin)
  const deferred = await getDeferredDraftFactoryStates(input.organizationId, repository)
  const due = await listDueDraftFactoryStates({
    organizationId: input.organizationId,
    now: input.now,
    limit: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
    repository,
  })

  // AUTONOMY-1F — include waiting_for_generation, not only portfolio_deferred.
  const pool = collectGenerationCapacityCandidates({
    deferredStates: deferred.map((row) => ({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
    })),
    dueStates: due.map((row) => ({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
    })),
    limit: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  })
  if (pool.candidates.length === 0) return 0

  const batch = planWakeEvaluationBatch({
    totalWaits: pool.candidates.length,
    perRunCap: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  })
  if (!batch.wakeExecutionEnabled || batch.effectiveLimit <= 0) return 0

  const capacityCandidates = []
  for (const [index, row] of pool.candidates.entries()) {
    const evidence = await buildCanonicalEvidenceForLead(admin, {
      organizationId: input.organizationId,
      leadId: row.leadId,
      portfolioSelected: true,
    })
    if (evidence.stopInvestment) continue
    capacityCandidates.push({
      leadId: row.leadId,
      investmentState: "increase_investment" as const,
      spendAuthorized: true,
      evidence,
      signals: { missionPriorityOverall: 100 - index },
    })
  }
  if (capacityCandidates.length === 0) return 0

  const result = await advanceDraftFactoryCapacityWake({
    organizationId: input.organizationId,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: batch.effectiveLimit,
    now: input.now,
    workerId: `df-wake-bus:${input.sourceId}`,
    repository,
    candidates: capacityCandidates,
    generateViaGrowth5F: async ({ organizationId, leadId, now: generatedAt }) => {
      const lead = await fetchGrowthLeadById(admin, leadId)
      if (!lead) return null
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId,
        leadId,
      })
      if (!snapshot) return null
      const growth5f = await buildAutonomousOutreachApprovalPackage(admin, {
        organizationId,
        leadId,
        companyName: lead.companyName,
        snapshot,
        generatedAt,
      })
      if (growth5f.pendingHumanApproval !== true || growth5f.transportBlocked !== true) {
        return null
      }
      return {
        packageId: growth5f.packageId,
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      }
    },
  })

  return result.results.filter((row) => row.outcome !== "duplicate_noop").length
}

async function applyLeadWake(
  admin: SupabaseClient,
  plan: Extract<DraftFactoryWakePlan, { kind: "lead" }>,
): Promise<boolean> {
  const result = await wakeDraftFactoryFromCompletionEvent(admin, {
    organizationId: plan.organizationId,
    leadId: plan.leadId,
    wake: { type: plan.wakeType, sourceId: plan.sourceId, eventId: plan.sourceId },
    portfolioSelected: true,
    allowGeneration: false,
  })
  return Boolean(result && result.outcome !== "duplicate_noop")
}

export async function observeDraftFactoryWakeEvent(
  event: AiOsEvent,
  admin?: SupabaseClient | null,
): Promise<DraftFactoryWakeObservationResult> {
  const plans = mapAiOsEventToDraftFactoryWakePlans(event)
  if (plans.length === 0) {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
      subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
      observed: false,
      plans: 0,
      advanced: 0,
      skipped: 0,
      reason: "ignored",
    }
  }

  const client = admin ?? createServiceRoleClient()
  if (!client) {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
      subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
      observed: false,
      plans: plans.length,
      advanced: 0,
      skipped: plans.length,
      reason: "admin_unavailable",
    }
  }

  const killSwitches = await getRuntimeKillSwitchStates(client).catch(() => null)
  if (killSwitches && !killSwitches.autonomy_enabled) {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
      subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
      observed: false,
      plans: plans.length,
      advanced: 0,
      skipped: plans.length,
      reason: "autonomy_disabled",
    }
  }

  const now = new Date().toISOString()
  let advanced = 0
  let skipped = 0

  for (const plan of plans) {
    try {
      if (plan.kind === "lead") {
        const didAdvance = await applyLeadWake(client, plan)
        if (didAdvance) advanced += 1
        else skipped += 1
        continue
      }

      if (plan.kind === "org_capacity") {
        advanced += await applyOrgCapacityWake(client, {
          organizationId: plan.organizationId,
          sourceId: plan.sourceId,
          now,
        })
        continue
      }

      if (plan.kind === "org_mission") {
        // Org-scoped mission change without lead ids — capacity-style due sweep only.
        advanced += await applyOrgCapacityWake(client, {
          organizationId: plan.organizationId,
          sourceId: plan.sourceId,
          now,
        })
      }
    } catch (error) {
      skipped += 1
      logGrowthEngine("draft_factory_wake_bus_plan_failed", {
        qa_marker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
        event_type: event.eventType,
        organization_id: event.organizationId,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  logGrowthEngine("draft_factory_wake_bus_observed", {
    qa_marker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
    event_type: event.eventType,
    organization_id: event.organizationId,
    plans: plans.length,
    advanced,
    skipped,
  })

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
    subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
    observed: true,
    plans: plans.length,
    advanced,
    skipped,
    reason: null,
  }
}

export async function observeDraftFactoryWakeEventForBus(event: AiOsEvent): Promise<void> {
  const admin = createServiceRoleClient()
  await observeDraftFactoryWakeEvent(event, admin)
}
