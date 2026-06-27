/** GE-AI-3C-PROD-1 — Revenue Director dispatch completion correlation service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import {
  buildRevenueDirectorDispatchIdempotencyKey,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"
import {
  buildRevenueDirectorDispatchCorrelationId,
  extractRevenueDirectorDispatchCorrelationResultReference,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_QA_MARKER,
  matchRevenueDirectorDispatchedWorkflowRequest,
  resolveRevenueDirectorDispatchCorrelationFromEvent,
  type GrowthRevenueDirectorDispatchCorrelation,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"
import {
  insertRevenueDirectorDecisionEvent,
  listRevenueDirectorDecisionEventsForOrganization,
  listRevenueDirectorWorkflowRequestsForOrganization,
  updateRevenueDirectorWorkflowRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import {
  formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage,
  isGrowthRevenueDirectorDecisionLedgerSchemaReady,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export type RevenueDirectorDispatchCorrelationApplyResult =
  | { ok: true; applied: false; reason: "ignored" | "schema_not_ready" | "no_match" | "already_terminal" }
  | { ok: true; applied: true; correlation: GrowthRevenueDirectorDispatchCorrelation }
  | { ok: false; error: string; message: string }

function mapTargetAgent(
  requestType: string,
): GrowthRevenueDirectorDispatchCorrelation["targetWorkflowAgent"] {
  switch (requestType) {
    case "run_research":
      return "research"
    case "rerun_qualification":
      return "qualification"
    case "request_communication_plan":
      return "communication_engine"
    case "generate_outreach":
      return "outreach_preparation"
    case "review_approval_queue":
      return "human_approval_center"
    default:
      return "revenue_operator"
  }
}

async function hasExistingCorrelationEvent(
  admin: SupabaseClient,
  input: { organizationId: string; workflowRequestId: string; eventId: string },
): Promise<boolean> {
  const events = await listRevenueDirectorDecisionEventsForOrganization(admin, {
    organizationId: input.organizationId,
    limit: 100,
  })
  const correlationId = buildRevenueDirectorDispatchCorrelationId(input.workflowRequestId, input.eventId)
  return events.some(
    (row) =>
      row.workflowRequestId === input.workflowRequestId &&
      typeof row.payload.correlationId === "string" &&
      row.payload.correlationId === correlationId,
  )
}

async function publishCorrelationLifecycleEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    workflowRequestId: string
    payload: Record<string, unknown>
    occurredAt: string
  },
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: "executive",
      source: "growth_revenue_director",
      producer: "growth_revenue_director_dispatch_correlation_service",
      subjectType: "system",
      subjectId: input.workflowRequestId,
      payload: input.payload,
      metadata: {
        qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_QA_MARKER,
        nonMutating: true,
        sendOccurred: false,
      },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Correlation publish must not block ledger update.
  }
}

export async function applyRevenueDirectorDispatchCorrelation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    event: AiOsEvent
    occurredAt?: string
  },
): Promise<RevenueDirectorDispatchCorrelationApplyResult> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return { ok: true, applied: false, reason: "schema_not_ready" }
  }

  const resolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
    eventType: input.event.eventType,
    payload: input.event.payload,
  })
  if (!resolution) {
    return { ok: true, applied: false, reason: "ignored" }
  }

  const dispatched = await listRevenueDirectorWorkflowRequestsForOrganization(admin, {
    organizationId: input.organizationId,
    status: ["dispatched"],
    limit: 48,
  })

  const matched = matchRevenueDirectorDispatchedWorkflowRequest({
    requests: dispatched,
    resolution,
    event: {
      eventType: input.event.eventType,
      entityId: input.event.entityId,
      payload: input.event.payload,
    },
  })

  if (!matched) {
    return { ok: true, applied: false, reason: "no_match" }
  }

  if (matched.status === "completed" || matched.status === "failed") {
    return { ok: true, applied: false, reason: "already_terminal" }
  }

  const duplicate = await hasExistingCorrelationEvent(admin, {
    organizationId: input.organizationId,
    workflowRequestId: matched.id,
    eventId: input.event.id,
  })
  if (duplicate) {
    return { ok: true, applied: false, reason: "already_terminal" }
  }

  const occurredAt = input.occurredAt ?? input.event.occurredAt ?? new Date().toISOString()
  const dispatchIdempotencyKey = buildRevenueDirectorDispatchIdempotencyKey(matched.id)
  const correlationId = buildRevenueDirectorDispatchCorrelationId(matched.id, input.event.id)
  const resultReference = extractRevenueDirectorDispatchCorrelationResultReference({
    eventType: input.event.eventType,
    entityId: input.event.entityId,
    payload: input.event.payload,
  })

  const evidence = [
    {
      source: "event_bus",
      label: "Event type",
      value: input.event.eventType,
    },
    {
      source: "event_bus",
      label: "Lifecycle alias",
      value: resolution.lifecycleAlias ?? "none",
    },
  ]

  const correlation: GrowthRevenueDirectorDispatchCorrelation = {
    id: correlationId,
    organizationId: input.organizationId,
    workflowRequestId: matched.id,
    dispatchIdempotencyKey,
    targetWorkflowAgent: resolution.targetAgent ?? mapTargetAgent(matched.requestType),
    status: resolution.outcome === "completed" ? "completed" : "failed",
    eventType: input.event.eventType,
    eventId: input.event.id,
    resultReference,
    evidence,
    createdAt: occurredAt,
  }

  await insertRevenueDirectorDecisionEvent(admin, {
    organizationId: input.organizationId,
    decisionId: matched.decisionId,
    workflowRequestId: matched.id,
    eventType: resolution.outcome === "completed" ? "completed" : "failed",
    payload: {
      correlationId,
      dispatchIdempotencyKey,
      eventId: input.event.id,
      eventType: input.event.eventType,
      resultReference,
      evidence,
      sendOccurred: false,
    },
  })

  await updateRevenueDirectorWorkflowRequestStatus(admin, {
    organizationId: input.organizationId,
    workflowRequestId: matched.id,
    status: resolution.outcome === "completed" ? "completed" : "failed",
    completedAt: resolution.outcome === "completed" ? occurredAt : null,
  })

  await publishCorrelationLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.matched,
    workflowRequestId: matched.id,
    payload: {
      correlationId,
      workflowRequestId: matched.id,
      eventId: input.event.id,
      eventType: input.event.eventType,
      resultReference,
    },
    occurredAt,
  })

  await publishCorrelationLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType:
      resolution.outcome === "completed"
        ? GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.completed
        : GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.failed,
    workflowRequestId: matched.id,
    payload: {
      correlationId,
      workflowRequestId: matched.id,
      resultReference,
      sendOccurred: false,
    },
    occurredAt,
  })

  if (resolution.outcome === "completed") {
    await publishCorrelationLifecycleEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.completed,
      workflowRequestId: matched.id,
      payload: {
        workflowRequestId: matched.id,
        correlationId,
        resultReference,
        sendOccurred: false,
      },
      occurredAt,
    })
  }

  return { ok: true, applied: true, correlation }
}

export async function observeRevenueDirectorDispatchCorrelationEvent(
  event: AiOsEvent,
): Promise<RevenueDirectorDispatchCorrelationApplyResult> {
  const admin = createServiceRoleClient()
  if (!admin) {
    return {
      ok: false,
      error: "service_role_unavailable",
      message: formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(),
    }
  }

  try {
    return await applyRevenueDirectorDispatchCorrelation(admin, {
      organizationId: event.organizationId,
      event,
    })
  } catch (error) {
    return {
      ok: false,
      error: "correlation_failed",
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
