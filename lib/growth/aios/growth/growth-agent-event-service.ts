/** GE-AIOS-GROWTH-4C — Agent Event & Scheduling service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listAiOsEvents } from "@/lib/growth/aios/ai-event-repository"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { buildGrowthLeadResearchExecutionPlanId } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { resolveEffectiveExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { fetchLatestExecutionPlanReviewForLead } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import { getLatestDryRunReportForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import { findExecutionRuntimeRecordForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { buildPilotEligibilityForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  buildAgentEventPlanContext,
  buildAgentEventQueueItem,
  buildAgentEventRecord,
  buildAgentEventsReadModel,
  inferAgentEventTypeFromPlanState,
  isAgentEventSchedulerActive,
  mapAiOsEventTypeToAgentEventType,
} from "@/lib/growth/aios/growth/growth-agent-event-engine"
import type {
  GrowthAgentEventPlanContext,
  GrowthAgentEventQueueItem,
  GrowthAgentEventRecord,
  GrowthAgentEventsReadModel,
} from "@/lib/growth/aios/growth/growth-agent-event-types"
import type { RevenueOperatorPlanStateInput } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export {
  buildAgentEventRecord,
  buildAgentEventQueueItem,
  buildAgentEventsReadModel,
  buildAgentEventPlanContext,
  resolveAgentEventRouting,
  mapAiOsEventTypeToAgentEventType,
  inferAgentEventTypeFromPlanState,
  isAgentEventSchedulerActive,
} from "@/lib/growth/aios/growth/growth-agent-event-engine"

function nowIso(): string {
  return new Date().toISOString()
}

function extractLeadIdFromAiOsEvent(event: AiOsEvent): string | null {
  const payload = event.payload as Record<string, unknown> | null
  if (!payload) return null
  const candidates = [payload.leadId, payload.entityId, payload.planId]
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value
  }
  return null
}

async function buildPlanStateMap(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<Map<string, RevenueOperatorPlanStateInput>> {
  const map = new Map<string, RevenueOperatorPlanStateInput>()
  const approvedPlans = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
  })

  for (const item of approvedPlans.slice(0, 24)) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    if (!snapshot?.executionPlan) continue

    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: item.leadId, plan: snapshot.executionPlan })
    const review = await fetchLatestExecutionPlanReviewForLead(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    const approvalStatus = resolveEffectiveExecutionPlanApprovalStatus({
      plan: snapshot.executionPlan,
      review,
      planId,
    })
    const pilotEligibility = await buildPilotEligibilityForPlan(admin, {
      organizationId: input.organizationId,
      planId,
      executionPlan: snapshot.executionPlan,
      approvalState: approvalStatus,
      confidence: item.confidence,
    })
    const runtimeRecord = await findExecutionRuntimeRecordForPlan(admin, {
      organizationId: input.organizationId,
      planId,
    })
    const latestDryRun = getLatestDryRunReportForPlan(planId)

    map.set(item.leadId, {
      leadId: item.leadId,
      companyId: item.leadId,
      companyName: item.companyName,
      planId,
      workflowType: snapshot.executionPlan.workflowType,
      approvalStatus,
      readinessState: item.readinessState,
      preflightStatus: null,
      pilotEligible: pilotEligibility.pilotEligible,
      pilotBlockedReasons: pilotEligibility.pilotBlockedReasons,
      runtimeState: runtimeRecord?.state ?? null,
      latestDryRunStatus: latestDryRun?.finalStatus ?? null,
      confidence: item.confidence,
    })
  }

  return map
}

function buildEventsFromAiOsBus(
  aiOsEvents: AiOsEvent[],
  planStatesByLeadId: Map<string, RevenueOperatorPlanStateInput>,
): GrowthAgentEventRecord[] {
  const events: GrowthAgentEventRecord[] = []

  for (const row of aiOsEvents) {
    const agentEventType = mapAiOsEventTypeToAgentEventType(row.eventType)
    if (!agentEventType) continue

    const leadId = extractLeadIdFromAiOsEvent(row)
    const planState = leadId ? planStatesByLeadId.get(leadId) ?? null : null

    events.push(
      buildAgentEventRecord({
        eventType: agentEventType,
        source: "ai_os_event_bus",
        timestamp: row.occurredAt,
        leadId,
        companyId: leadId,
        companyName: planState?.companyName ?? null,
        workflowType: planState?.workflowType ?? null,
        priority: row.category === "approval" ? "high" : "normal",
        triggeringReason: `AI OS event ${row.eventType} observed read-only.`,
        planState,
        aiOsEventType: row.eventType,
      }),
    )
  }

  return events
}

function buildEventsFromPlanStates(
  planStatesByLeadId: Map<string, RevenueOperatorPlanStateInput>,
  generatedAt: string,
): GrowthAgentEventRecord[] {
  const events: GrowthAgentEventRecord[] = []

  for (const planState of planStatesByLeadId.values()) {
    const eventType = inferAgentEventTypeFromPlanState({
      workflowType: planState.workflowType,
      approvalStatus: planState.approvalStatus,
      readinessState: planState.readinessState,
      latestDryRunStatus: planState.latestDryRunStatus,
      runtimeState: planState.runtimeState,
    })

    events.push(
      buildAgentEventRecord({
        eventType,
        source: "plan_state",
        timestamp: generatedAt,
        leadId: planState.leadId,
        companyId: planState.companyId,
        companyName: planState.companyName,
        workflowType: planState.workflowType,
        priority: planState.approvalStatus === "approved_for_future_execution" ? "high" : "normal",
        triggeringReason: `Plan state snapshot for ${planState.workflowType.replaceAll("_", " ")}.`,
        planState,
        blockedReasons: planState.pilotBlockedReasons ?? [],
      }),
    )
  }

  return events
}

function dedupeEvents(events: GrowthAgentEventRecord[]):): GrowthAgentEventRecord[] {
  const seen = new Set<string>()
  const result: GrowthAgentEventRecord[] = []

  for (const event of events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const key = `${event.eventType}:${event.leadId ?? "global"}:${event.source}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(event)
  }

  return result
}

export async function buildGrowthAgentEventsReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; limit?: number },
): Promise<GrowthAgentEventsReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const limit = input.limit ?? 24

  const [aiOsEvents, planStatesByLeadId] = await Promise.all([
    listAiOsEvents(admin, { organizationId: input.organizationId, limit }),
    buildPlanStateMap(admin, { organizationId: input.organizationId }),
  ])

  const busEvents = buildEventsFromAiOsBus(aiOsEvents, planStatesByLeadId)
  const planEvents = buildEventsFromPlanStates(planStatesByLeadId, generatedAt)
  const dailyReview = buildAgentEventRecord({
    eventType: "daily_review",
    source: "scheduler_placeholder",
    timestamp: generatedAt,
    priority: "low",
    triggeringReason: "Daily review placeholder — scheduler disabled in 4C.",
  })

  const events = dedupeEvents([...busEvents, ...planEvents, dailyReview]).slice(0, limit)

  void isAgentEventSchedulerActive()

  return buildAgentEventsReadModel({
    events,
    planStatesByLeadId,
    generatedAt,
  })
}

export async function buildGrowthAgentEventPlanContext(
  admin: SupabaseClient,
  input: RevenueOperatorPlanStateInput,
): Promise<GrowthAgentEventPlanContext | null> {
  void admin
  const eventType = inferAgentEventTypeFromPlanState({
    workflowType: input.workflowType,
    approvalStatus: input.approvalStatus,
    readinessState: input.readinessState,
    latestDryRunStatus: input.latestDryRunStatus,
    runtimeState: input.runtimeState,
  })
  const event = buildAgentEventRecord({
    eventType,
    source: "plan_state",
    timestamp: input.generatedAt ?? new Date(0).toISOString(),
    leadId: input.leadId,
    companyId: input.companyId,
    companyName: input.companyName,
    workflowType: input.workflowType,
    triggeringReason: `Latest plan-state event for ${input.workflowType.replaceAll("_", " ")}.`,
    planState: input,
    blockedReasons: input.pilotBlockedReasons ?? [],
  })
  const queueItem = buildAgentEventQueueItem({ event, planState: input })
  return buildAgentEventPlanContext({ queueItem })
}

export function findLatestEventForLead(
  readModel: GrowthAgentEventsReadModel,
  leadId: string,
): GrowthAgentEventQueueItem | null {
  return readModel.latestEvents.find((row) => row.leadId === leadId) ?? null
}
