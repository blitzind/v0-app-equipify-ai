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
import { generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  createDraftFactoryWakeObservabilityHandle,
  createFailedDraftFactoryWakeAttempt,
  createSkippedDraftFactoryWakeAttempt,
  recordDraftFactoryWakeSubscriberObservation,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-service"
import { resolveGrowthRuntimeInstanceId } from "@/lib/growth/draft-factory/draft-factory-wake-observability-runtime"

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
      const persisted = await generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(
        admin,
        {
          organizationId,
          leadId,
          generatedAt,
        },
      )
      if (!persisted) return null
      return {
        packageId: persisted.packageId,
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      }
    },
  })

  return result.results.filter((row) => row.outcome !== "duplicate_noop").length
}

async function applyLeadWake(
  admin: SupabaseClient,
  event: AiOsEvent,
  plan: Extract<DraftFactoryWakePlan, { kind: "lead" }>,
): Promise<boolean> {
  const runtimeInstance = resolveGrowthRuntimeInstanceId()
  const researchRunId =
    typeof event.payload?.research_run_id === "string" ? event.payload.research_run_id : null
  const subscriberStartedAt = new Date().toISOString()

  const observability = await createDraftFactoryWakeObservabilityHandle(admin, {
    eventId: event.id,
    organizationId: plan.organizationId,
    leadId: plan.leadId,
    researchRunId,
    wakeType: plan.wakeType,
    subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
    invocationSource: event.source || event.producer,
    runtimeInstance,
    sourceId: plan.sourceId,
  })

  await observability.recordTransition("HANDLER_STARTED", {
    subscriber_id: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
  })
  await observability.recordTransition("PLAN_CREATED", {
    wake_type: plan.wakeType,
    source_id: plan.sourceId,
  })

  await recordDraftFactoryWakeSubscriberObservation(admin, {
    wakeAttemptId: observability.wakeAttemptId,
    eventId: event.id,
    organizationId: plan.organizationId,
    subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
    received: true,
    status: "started",
    startedAt: subscriberStartedAt,
  })

  const result = await wakeDraftFactoryFromCompletionEvent(admin, {
    organizationId: plan.organizationId,
    leadId: plan.leadId,
    wake: { type: plan.wakeType, sourceId: plan.sourceId, eventId: plan.sourceId },
    portfolioSelected: true,
    allowGeneration: false,
    observability,
  })

  const completedAt = new Date().toISOString()
  const didAdvance = Boolean(result && result.outcome !== "duplicate_noop")

  await recordDraftFactoryWakeSubscriberObservation(admin, {
    wakeAttemptId: observability.wakeAttemptId,
    eventId: event.id,
    organizationId: plan.organizationId,
    subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
    received: true,
    status: didAdvance ? "completed" : result ? "skipped" : "failed",
    startedAt: subscriberStartedAt,
    completedAt,
    durationMs: Date.parse(completedAt) - Date.parse(subscriberStartedAt),
    skipReason: result?.outcome === "duplicate_noop" ? result.reason : result ? null : "wake_returned_null",
    errorMessage: result ? null : "wakeDraftFactoryFromCompletionEvent returned null",
  })

  return didAdvance
}

async function recordSkippedLeadPlans(
  admin: SupabaseClient,
  event: AiOsEvent,
  plans: DraftFactoryWakePlan[],
  reason: string,
): Promise<void> {
  const runtimeInstance = resolveGrowthRuntimeInstanceId()
  const researchRunId =
    typeof event.payload?.research_run_id === "string" ? event.payload.research_run_id : null

  for (const plan of plans) {
    if (plan.kind !== "lead") continue
    await createSkippedDraftFactoryWakeAttempt(admin, {
      eventId: event.id,
      organizationId: plan.organizationId,
      leadId: plan.leadId,
      researchRunId,
      wakeType: plan.wakeType,
      subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
      invocationSource: event.source || event.producer,
      runtimeInstance,
      sourceId: plan.sourceId,
      reason,
    })
  }
}

export async function observeDraftFactoryWakeEvent(
  event: AiOsEvent,
  admin?: SupabaseClient | null,
): Promise<DraftFactoryWakeObservationResult> {
  const plans = mapAiOsEventToDraftFactoryWakePlans(event)
  if (plans.length === 0) {
    const workflowStatus =
      typeof event.payload?.workflow_status === "string" ? event.payload.workflow_status : null
    if (workflowStatus === "research_complete" && event.entityId) {
      const telemetryClient = admin ?? createServiceRoleClient()
      if (telemetryClient) {
        await createSkippedDraftFactoryWakeAttempt(telemetryClient, {
          eventId: event.id,
          organizationId: event.organizationId,
          leadId: event.entityId,
          researchRunId:
            typeof event.payload?.research_run_id === "string" ? event.payload.research_run_id : null,
          wakeType: "research_completed",
          subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
          invocationSource: event.source || event.producer,
          runtimeInstance: resolveGrowthRuntimeInstanceId(),
          sourceId:
            typeof event.payload?.research_run_id === "string"
              ? event.payload.research_run_id
              : event.id,
          reason: "no_wake_plan_mapped",
        }).catch(() => undefined)
      }
    }
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
    await recordSkippedLeadPlans(client, event, plans, "autonomy_disabled").catch(() => undefined)
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
        const didAdvance = await applyLeadWake(client, event, plan)
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
      if (plan.kind === "lead") {
        await createFailedDraftFactoryWakeAttempt(client, {
          eventId: event.id,
          organizationId: plan.organizationId,
          leadId: plan.leadId,
          researchRunId:
            typeof event.payload?.research_run_id === "string" ? event.payload.research_run_id : null,
          wakeType: plan.wakeType,
          subscriberId: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
          invocationSource: event.source || event.producer,
          runtimeInstance: resolveGrowthRuntimeInstanceId(),
          sourceId: plan.sourceId,
          reason: "plan_execution_failed",
          error,
          stage: "HANDLER_STARTED",
        }).catch(() => undefined)
      }
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
