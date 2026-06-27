/** GE-AI-3C — Revenue Director active orchestration dispatch service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  evaluateOutreachPreparationPilotAutonomyPolicyGate,
  evaluateQualificationPilotAutonomyPolicyGate,
  evaluateResearchPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { runRevenueDirectorDispatchAdapter } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-adapters"
import {
  synthesizeRevenueDirectorDispatchEligibility,
  validateRevenueDirectorDispatchRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-guardrails"
import {
  GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
  buildRevenueDirectorDispatchIdempotencyKey,
  isRevenueDirectorDispatchableRequestType,
  type GrowthRevenueDirectorDispatchAdapterResult,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import {
  fetchRevenueDirectorWorkflowRequestById,
  insertRevenueDirectorDecisionEvent,
  updateRevenueDirectorWorkflowRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import {
  formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage,
  isGrowthRevenueDirectorDecisionLedgerSchemaReady,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health"

export type RevenueDirectorDispatchServiceResult =
  | {
      ok: true
      qaMarker: typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER
      rule: typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE
      idempotent: boolean
      workflowRequestId: string
      result: GrowthRevenueDirectorDispatchAdapterResult
      dispatched: boolean
      sendOccurred: false
    }
  | {
      ok: false
      qaMarker: typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER
      rule: typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE
      error: string
      message: string
      blockReason?: string
      dispatched: false
      sendOccurred: false
    }

async function publishDispatchEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    subjectId: string
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
      producer: "growth_revenue_director_dispatch_service",
      subjectType: "system",
      subjectId: input.subjectId,
      payload: input.payload,
      metadata: {
        qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
        nonMutating: false,
        advisoryOnly: false,
        transportBlocked: true,
        sendOccurred: false,
      },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Dispatch events must not crash orchestration.
  }
}

async function evaluateRevenueDirectorDispatchAutonomyGate(
  admin: SupabaseClient,
  input: {
    organizationId: string
    requestType: string
    occurredAt: string
  },
): Promise<{ allowed: boolean; blockReason: string | null; gateId?: string }> {
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt: input.occurredAt,
  })

  switch (input.requestType) {
    case "run_research": {
      const gate = evaluateResearchPilotAutonomyPolicyGate(evaluationContext.policy)
      return {
        allowed: gate.allowed,
        blockReason: gate.blockReason,
        gateId: gate.gateId,
      }
    }
    case "rerun_qualification": {
      const gate = evaluateQualificationPilotAutonomyPolicyGate(evaluationContext)
      return {
        allowed: gate.allowed,
        blockReason: gate.blockReason,
        gateId: gate.gateId,
      }
    }
    case "generate_outreach": {
      const gate = evaluateOutreachPreparationPilotAutonomyPolicyGate(evaluationContext)
      return {
        allowed: gate.allowed,
        blockReason: gate.blockReason,
        gateId: gate.gateId,
      }
    }
    case "request_communication_plan": {
      if (evaluationContext.policy.emergencyStopActive) {
        return {
          allowed: false,
          blockReason: "Emergency stop active — communication planning blocked.",
          gateId: "emergency_stop",
        }
      }
      return { allowed: true, blockReason: null, gateId: "communication_planning" }
    }
    case "review_approval_queue":
      return { allowed: true, blockReason: null, gateId: "human_approval_route" }
    default:
      return { allowed: false, blockReason: "Request type blocked by Growth Autonomy.", gateId: "unknown_request_type" }
  }
}

export async function dispatchRevenueDirectorWorkflowRequest(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workflowRequestId: string
    operatorUserId: string
    occurredAt: string
  },
): Promise<RevenueDirectorDispatchServiceResult> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "schema_not_ready",
      message: formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(),
      dispatched: false,
      sendOccurred: false,
    }
  }

  const request = await fetchRevenueDirectorWorkflowRequestById(admin, {
    organizationId: input.organizationId,
    workflowRequestId: input.workflowRequestId,
  })
  if (!request) {
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "workflow_request_not_found",
      message: "Workflow request not found.",
      dispatched: false,
      sendOccurred: false,
    }
  }

  const dispatchIdempotencyKey = buildRevenueDirectorDispatchIdempotencyKey(request.id)

  if (request.status === "dispatched" || request.status === "completed") {
    return {
      ok: true,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      idempotent: true,
      workflowRequestId: request.id,
      result: {
        ok: true,
        targetAgent: synthesizeRevenueDirectorDispatchEligibility({ request }).targetAgent ?? "research_agent",
        requestType: isRevenueDirectorDispatchableRequestType(request.requestType)
          ? request.requestType
          : "review_approval_queue",
        references: [],
        completed: request.status === "completed",
        sendOccurred: false,
        transportBlocked: true,
        summary: "Dispatch already recorded — idempotent replay.",
      },
      dispatched: true,
      sendOccurred: false,
    }
  }

  const eligibility = synthesizeRevenueDirectorDispatchEligibility({ request })
  if (!eligibility.eligible) {
    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: request.decisionId,
      workflowRequestId: request.id,
      eventType: "failed",
      payload: {
        phase: "dispatch_blocked",
        blockReason: eligibility.blockReason,
        operatorUserId: input.operatorUserId,
        dispatchIdempotencyKey,
      },
    })
    await publishDispatchEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.dispatchBlocked,
      subjectId: request.id,
      payload: {
        workflowRequestId: request.id,
        blockReason: eligibility.blockReason,
        requestType: request.requestType,
      },
      occurredAt: input.occurredAt,
    })
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "dispatch_blocked",
      message: eligibility.blockReason ?? "Dispatch blocked.",
      blockReason: eligibility.blockReason ?? undefined,
      dispatched: false,
      sendOccurred: false,
    }
  }

  const statusGate = validateRevenueDirectorDispatchRequestStatus(request)
  if (!statusGate.allowed) {
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "invalid_status",
      message: statusGate.blockReason ?? "Invalid workflow request status.",
      dispatched: false,
      sendOccurred: false,
    }
  }

  const autonomyGate = await evaluateRevenueDirectorDispatchAutonomyGate(admin, {
    organizationId: input.organizationId,
    requestType: request.requestType,
    occurredAt: input.occurredAt,
  })
  if (!autonomyGate.allowed) {
    await publishDispatchEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.dispatchBlocked,
      subjectId: request.id,
      payload: {
        workflowRequestId: request.id,
        blockReason: autonomyGate.blockReason,
        gateId: autonomyGate.gateId,
        requestType: request.requestType,
      },
      occurredAt: input.occurredAt,
    })
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "autonomy_blocked",
      message: autonomyGate.blockReason ?? "Growth Autonomy blocked dispatch.",
      blockReason: autonomyGate.blockReason ?? undefined,
      dispatched: false,
      sendOccurred: false,
    }
  }

  await publishDispatchEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.dispatchRequested,
    subjectId: request.id,
    payload: {
      workflowRequestId: request.id,
      requestType: request.requestType,
      operatorUserId: input.operatorUserId,
      dispatchIdempotencyKey,
    },
    occurredAt: input.occurredAt,
  })

  await insertRevenueDirectorDecisionEvent(admin, {
    organizationId: input.organizationId,
    decisionId: request.decisionId,
    workflowRequestId: request.id,
    eventType: "dispatched",
    payload: {
      operatorUserId: input.operatorUserId,
      dispatchIdempotencyKey,
      phase: "dispatch_requested",
    },
  })

  try {
    const adapterResult = await runRevenueDirectorDispatchAdapter(admin, {
      organizationId: input.organizationId,
      request,
      occurredAt: input.occurredAt,
    })

    const nextStatus = adapterResult.completed ? "completed" : "dispatched"
    await updateRevenueDirectorWorkflowRequestStatus(admin, {
      organizationId: input.organizationId,
      workflowRequestId: request.id,
      status: nextStatus,
      dispatchedAt: input.occurredAt,
      completedAt: adapterResult.completed ? input.occurredAt : null,
    })

    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: request.decisionId,
      workflowRequestId: request.id,
      eventType: adapterResult.completed ? "completed" : "dispatched",
      payload: {
        operatorUserId: input.operatorUserId,
        dispatchIdempotencyKey,
        references: adapterResult.references,
        targetAgent: adapterResult.targetAgent,
        sendOccurred: false,
      },
    })

    await publishDispatchEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.dispatched,
      subjectId: request.id,
      payload: {
        workflowRequestId: request.id,
        targetAgent: adapterResult.targetAgent,
        references: adapterResult.references,
        sendOccurred: false,
      },
      occurredAt: input.occurredAt,
    })

    if (adapterResult.completed) {
      await publishDispatchEvent(admin, {
        organizationId: input.organizationId,
        eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.completed,
        subjectId: request.id,
        payload: {
          workflowRequestId: request.id,
          references: adapterResult.references,
          sendOccurred: false,
        },
        occurredAt: input.occurredAt,
      })
      await publishDispatchEvent(admin, {
        organizationId: input.organizationId,
        eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.workflowRequestCompleted,
        subjectId: request.id,
        payload: { workflowRequestId: request.id, dispatched: true, sendOccurred: false },
        occurredAt: input.occurredAt,
      })
    }

    return {
      ok: true,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      idempotent: false,
      workflowRequestId: request.id,
      result: adapterResult,
      dispatched: true,
      sendOccurred: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "dispatch_failed"
    await updateRevenueDirectorWorkflowRequestStatus(admin, {
      organizationId: input.organizationId,
      workflowRequestId: request.id,
      status: "failed",
    })
    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: request.decisionId,
      workflowRequestId: request.id,
      eventType: "failed",
      payload: {
        operatorUserId: input.operatorUserId,
        dispatchIdempotencyKey,
        error: message,
      },
    })
    await publishDispatchEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES.dispatchFailed,
      subjectId: request.id,
      payload: { workflowRequestId: request.id, error: message, sendOccurred: false },
      occurredAt: input.occurredAt,
    })
    return {
      ok: false,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
      rule: GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
      error: "dispatch_failed",
      message,
      dispatched: false,
      sendOccurred: false,
    }
  }
}

export { synthesizeRevenueDirectorDispatchEligibility } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-guardrails"
