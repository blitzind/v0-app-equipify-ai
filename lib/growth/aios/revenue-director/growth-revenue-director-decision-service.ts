/** GE-AI-3B — Revenue Director decision ledger service (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type {
  GrowthRevenueDirectorDecisionLedgerReadModel,
  GrowthRevenueDirectorDecisionRecord,
  GrowthRevenueDirectorWorkflowRequestRecord,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import {
  buildRevenueDirectorWorkflowRequestIdempotencyKey,
  canTransitionDecisionStatus,
  canTransitionWorkflowRequestStatus,
  computeRevenueDirectorSnapshotHash,
  mapAdvisoryRequestToLedgerSubject,
  resolveLedgerWorkflowVisibility,
  synthesizeEmptyDecisionLedgerReadModel,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-helpers"
import {
  fetchRevenueDirectorWorkflowRequestById,
  fetchRevenueDirectorDecisionById,
  insertRevenueDirectorDecision,
  insertRevenueDirectorDecisionEvent,
  insertRevenueDirectorWorkflowRequest,
  listRevenueDirectorDecisionEventsForOrganization,
  listRevenueDirectorDecisionsForOrganization,
  listRevenueDirectorWorkflowRequestsForOrganization,
  supersedeStaleRevenueDirectorDecisions,
  updateRevenueDirectorDecisionStatus,
  updateRevenueDirectorWorkflowRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import {
  formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage,
  isGrowthRevenueDirectorDecisionLedgerSchemaReady,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health"
import { synthesizeRevenueDirectorDispatchEligibility } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-guardrails"
import {
  resolveRevenueDirectorDispatchCorrelationReadStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"

const HIDDEN_LEDGER_STATUSES = new Set(["completed", "superseded", "cancelled"])

function buildLedgerSummary(input: {
  decisions: GrowthRevenueDirectorDecisionRecord[]
  workflowRequests: GrowthRevenueDirectorWorkflowRequestRecord[]
}): GrowthRevenueDirectorDecisionLedgerReadModel["summary"] {
  const pendingDecisions = input.decisions.filter((row) => row.status === "proposed").length
  const pendingRequests = input.workflowRequests.filter((row) => row.status === "proposed").length
  const acceptedRequests = input.workflowRequests.filter((row) => row.status === "accepted").length
  const completedCount = input.workflowRequests.filter((row) => row.status === "completed").length
  const supersededCount =
    input.decisions.filter((row) => row.status === "superseded").length +
    input.workflowRequests.filter((row) => row.status === "superseded").length
  const cancelledCount =
    input.decisions.filter((row) => row.status === "cancelled").length +
    input.workflowRequests.filter((row) => row.status === "cancelled").length

  const topRequest =
    input.workflowRequests
      .filter((row) => row.status === "proposed" || row.status === "accepted")
      .sort((left, right) => right.priorityScore - left.priorityScore)[0] ?? null

  return {
    pendingDecisions,
    pendingRequests,
    acceptedRequests,
    completedCount,
    supersededCount,
    cancelledCount,
    topRecommendedRequestTitle: topRequest?.title ?? null,
    topRecommendedRequestType: topRequest?.requestType ?? null,
  }
}

export async function buildRevenueDirectorDecisionLedgerReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt: string },
): Promise<GrowthRevenueDirectorDecisionLedgerReadModel> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return synthesizeEmptyDecisionLedgerReadModel({ generatedAt: input.generatedAt, schemaReady: false })
  }

  const [decisions, workflowRequests, recentEvents] = await Promise.all([
    listRevenueDirectorDecisionsForOrganization(admin, {
      organizationId: input.organizationId,
      limit: 24,
    }),
    listRevenueDirectorWorkflowRequestsForOrganization(admin, {
      organizationId: input.organizationId,
      limit: 48,
    }),
    listRevenueDirectorDecisionEventsForOrganization(admin, {
      organizationId: input.organizationId,
      limit: 20,
    }),
  ])

  return {
    readOnly: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
    schemaReady: true,
    summary: buildLedgerSummary({ decisions, workflowRequests }),
    decisions,
    workflowRequests,
    recentEvents,
  }
}

async function publishLedgerEvent(
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
      producer: "growth_revenue_director_decision_service",
      subjectType: "system",
      subjectId: input.subjectId,
      payload: input.payload,
      metadata: {
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        nonMutating: true,
        advisoryOnly: true,
      },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Event publish must not block ledger lifecycle.
  }
}

export async function syncRevenueDirectorDecisionLedger(
  admin: SupabaseClient,
  input: {
    organizationId: string
    revenueDirector: GrowthRevenueDirectorReadModel
    generatedAt: string
  },
): Promise<GrowthRevenueDirectorDecisionLedgerReadModel> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return synthesizeEmptyDecisionLedgerReadModel({ generatedAt: input.generatedAt, schemaReady: false })
  }

  const snapshotHash = computeRevenueDirectorSnapshotHash({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    revenueHealth: input.revenueDirector.executiveSummary.revenueHealth,
    workflowRequestIds: input.revenueDirector.workflowRequests.map((row) => row.id),
  })

  const supersededDecisions = await supersedeStaleRevenueDirectorDecisions(admin, {
    organizationId: input.organizationId,
    currentSnapshotHash: snapshotHash,
    supersededAt: input.generatedAt,
  })

  for (const superseded of supersededDecisions) {
    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: superseded.id,
      eventType: "superseded",
      payload: { snapshotHash: superseded.snapshotHash, advisoryOnly: true },
    })
    await publishLedgerEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.decisionSuperseded,
      subjectId: superseded.id,
      payload: { decisionId: superseded.id, snapshotHash: superseded.snapshotHash },
      occurredAt: input.generatedAt,
    })
  }

  const topPriority = input.revenueDirector.workflowRequests[0]?.priorityScore ?? 0
  const decision = await insertRevenueDirectorDecision(admin, {
    organizationId: input.organizationId,
    snapshotHash,
    title: input.revenueDirector.executiveSummary.headline,
    summary: input.revenueDirector.executiveSummary.primaryFocus ?? "",
    confidence: topPriority,
    priorityScore: topPriority,
    evidence: input.revenueDirector.workflowRequests[0]?.evidence ?? [],
    risks: input.revenueDirector.risks.map((risk) => ({
      label: risk.label,
      severity: risk.severity,
      summary: risk.summary,
    })),
  })

  const isNewDecision = decision.createdAt === decision.updatedAt
  if (isNewDecision) {
    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      eventType: "proposed",
      payload: { snapshotHash, advisoryOnly: true },
    })
    await publishLedgerEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.decisionProposed,
      subjectId: decision.id,
      payload: { decisionId: decision.id, snapshotHash, status: decision.status },
      occurredAt: input.generatedAt,
    })
  }

  for (const advisoryRequest of input.revenueDirector.workflowRequests) {
    const idempotencyKey = buildRevenueDirectorWorkflowRequestIdempotencyKey({
      organizationId: input.organizationId,
      advisoryRequestId: advisoryRequest.id,
    })
    const subject = mapAdvisoryRequestToLedgerSubject(advisoryRequest)
    const existingBefore = await insertRevenueDirectorWorkflowRequest(admin, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      requestType: advisoryRequest.requestType,
      targetWorkflowAgent: advisoryRequest.targetWorkflowAgent,
      status: "proposed",
      advisory: true,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      objectiveId: subject.objectiveId,
      missionId: subject.missionId,
      leadId: subject.leadId,
      title: advisoryRequest.title,
      summary: advisoryRequest.summary,
      priorityScore: advisoryRequest.priorityScore,
      requiresHumanApproval: advisoryRequest.requiresHumanApproval,
      idempotencyKey,
      correlationId: randomUUID(),
      evidence: advisoryRequest.evidence,
      route: advisoryRequest.routeHint ?? null,
      acceptedAt: null,
      dispatchedAt: null,
      completedAt: null,
      cancelledAt: null,
      supersededAt: null,
    })

    const isNewRequest = existingBefore.createdAt === existingBefore.updatedAt
    if (isNewRequest) {
      await insertRevenueDirectorDecisionEvent(admin, {
        organizationId: input.organizationId,
        decisionId: decision.id,
        workflowRequestId: existingBefore.id,
        eventType: "proposed",
        payload: { idempotencyKey, requestType: advisoryRequest.requestType },
      })
      await publishLedgerEvent(admin, {
        organizationId: input.organizationId,
        eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.workflowRequestProposed,
        subjectId: existingBefore.id,
        payload: {
          workflowRequestId: existingBefore.id,
          decisionId: decision.id,
          requestType: advisoryRequest.requestType,
          idempotencyKey,
        },
        occurredAt: input.generatedAt,
      })
    }
  }

  return buildRevenueDirectorDecisionLedgerReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })
}

export function enrichRevenueDirectorWithDecisionLedger(input: {
  organizationId: string
  revenueDirector: GrowthRevenueDirectorReadModel
  ledger: GrowthRevenueDirectorDecisionLedgerReadModel
}): GrowthRevenueDirectorReadModel {
  const statusByKey = new Map(
    input.ledger.workflowRequests.map((row) => [row.idempotencyKey, row.status]),
  )
  const recordByKey = new Map(
    input.ledger.workflowRequests.map((row) => [row.idempotencyKey, row]),
  )
  const correlationEventByRequestId = new Map(
    input.ledger.recentEvents
      .filter((row) => row.workflowRequestId && row.payload.resultReference)
      .map((row) => [row.workflowRequestId!, row]),
  )

  const enrichedRequests = input.revenueDirector.workflowRequests
    .map((request) => {
      const idempotencyKey = buildRevenueDirectorWorkflowRequestIdempotencyKey({
        organizationId: input.organizationId,
        advisoryRequestId: request.id,
      })
      const ledgerStatus = resolveLedgerWorkflowVisibility({
        idempotencyKey,
        existingStatusByKey: statusByKey,
      })
      const ledgerRecord = recordByKey.get(idempotencyKey)
      const correlationEvent = ledgerRecord ? correlationEventByRequestId.get(ledgerRecord.id) : undefined
      const correlationPayload = correlationEvent?.payload
      return {
        ...request,
        ledgerStatus,
        ledgerRequestId: ledgerRecord?.id,
        isStale: ledgerStatus === "superseded",
        dispatchEligibility: ledgerRecord
          ? synthesizeRevenueDirectorDispatchEligibility({ request: ledgerRecord })
          : undefined,
        correlationStatus: ledgerRecord
          ? resolveRevenueDirectorDispatchCorrelationReadStatus({
              workflowRequestStatus: ledgerRecord.status,
              dispatchedAt: ledgerRecord.dispatchedAt,
              generatedAt: input.ledger.generatedAt,
            })
          : undefined,
        correlationResultReference:
          correlationPayload?.resultReference &&
          typeof correlationPayload.resultReference === "object"
            ? (correlationPayload.resultReference as import("@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types").GrowthRevenueDirectorDispatchCorrelationResultReference)
            : undefined,
        correlationFailureReason:
          ledgerRecord?.status === "failed"
            ? String(correlationPayload?.eventType ?? "Workflow agent reported failure.")
            : null,
      }
    })
    .filter((request) => !HIDDEN_LEDGER_STATUSES.has(request.ledgerStatus ?? "new"))

  return {
    ...input.revenueDirector,
    workflowRequests: enrichedRequests,
    decisionLedger: {
      readOnly: true,
      schemaReady: input.ledger.schemaReady,
      summary: input.ledger.summary,
      pendingDecisions: input.ledger.summary.pendingDecisions,
      pendingRequests: input.ledger.summary.pendingRequests,
      acceptedRequests: input.ledger.summary.acceptedRequests,
      completedCount: input.ledger.summary.completedCount,
      supersededCount: input.ledger.summary.supersededCount,
    },
  }
}

export async function acceptRevenueDirectorDecision(
  admin: SupabaseClient,
  input: { organizationId: string; decisionId: string; operatorUserId: string; occurredAt: string },
): Promise<
  | { ok: true; decision: GrowthRevenueDirectorDecisionRecord; workflowRequests: GrowthRevenueDirectorWorkflowRequestRecord[] }
  | { ok: false; error: string; message: string }
> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(),
    }
  }

  const decision = await fetchRevenueDirectorDecisionById(admin, {
    organizationId: input.organizationId,
    decisionId: input.decisionId,
  })
  if (!decision) {
    return { ok: false, error: "decision_not_found", message: "Decision not found." }
  }
  if (!canTransitionDecisionStatus(decision.status, "accepted")) {
    return { ok: false, error: "invalid_transition", message: `Cannot accept decision in status ${decision.status}.` }
  }

  const updatedDecision = await updateRevenueDirectorDecisionStatus(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    status: "accepted",
  })

  await insertRevenueDirectorDecisionEvent(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    eventType: "accepted",
    payload: { operatorUserId: input.operatorUserId, dispatchBlocked: true },
  })

  await publishLedgerEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.decisionAccepted,
    subjectId: decision.id,
    payload: { decisionId: decision.id, operatorUserId: input.operatorUserId, dispatched: false },
    occurredAt: input.occurredAt,
  })

  const workflowRequests = await listRevenueDirectorWorkflowRequestsForOrganization(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    status: ["proposed"],
  })

  const acceptedRequests: GrowthRevenueDirectorWorkflowRequestRecord[] = []
  for (const request of workflowRequests) {
    if (!canTransitionWorkflowRequestStatus(request.status, "accepted")) continue
    const accepted = await updateRevenueDirectorWorkflowRequestStatus(admin, {
      organizationId: input.organizationId,
      workflowRequestId: request.id,
      status: "accepted",
      acceptedAt: input.occurredAt,
    })
    acceptedRequests.push(accepted)

    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      workflowRequestId: request.id,
      eventType: "accepted",
      payload: { operatorUserId: input.operatorUserId, dispatchBlocked: true },
    })

    await publishLedgerEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.workflowRequestAccepted,
      subjectId: request.id,
      payload: { workflowRequestId: request.id, decisionId: decision.id, dispatched: false },
      occurredAt: input.occurredAt,
    })
  }

  return { ok: true, decision: updatedDecision, workflowRequests: acceptedRequests }
}

export async function cancelRevenueDirectorDecision(
  admin: SupabaseClient,
  input: { organizationId: string; decisionId: string; operatorUserId: string; occurredAt: string },
): Promise<
  | { ok: true; decision: GrowthRevenueDirectorDecisionRecord }
  | { ok: false; error: string; message: string }
> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(),
    }
  }

  const decision = await fetchRevenueDirectorDecisionById(admin, {
    organizationId: input.organizationId,
    decisionId: input.decisionId,
  })
  if (!decision) {
    return { ok: false, error: "decision_not_found", message: "Decision not found." }
  }
  if (!canTransitionDecisionStatus(decision.status, "cancelled")) {
    return { ok: false, error: "invalid_transition", message: `Cannot cancel decision in status ${decision.status}.` }
  }

  const updatedDecision = await updateRevenueDirectorDecisionStatus(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    status: "cancelled",
  })

  await insertRevenueDirectorDecisionEvent(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    eventType: "cancelled",
    payload: { operatorUserId: input.operatorUserId, dispatchBlocked: true },
  })

  await publishLedgerEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.decisionCancelled,
    subjectId: decision.id,
    payload: { decisionId: decision.id, operatorUserId: input.operatorUserId, dispatched: false },
    occurredAt: input.occurredAt,
  })

  const workflowRequests = await listRevenueDirectorWorkflowRequestsForOrganization(admin, {
    organizationId: input.organizationId,
    decisionId: decision.id,
    status: ["proposed", "accepted"],
  })

  for (const request of workflowRequests) {
    if (!canTransitionWorkflowRequestStatus(request.status, "cancelled")) continue
    await updateRevenueDirectorWorkflowRequestStatus(admin, {
      organizationId: input.organizationId,
      workflowRequestId: request.id,
      status: "cancelled",
      cancelledAt: input.occurredAt,
    })
    await insertRevenueDirectorDecisionEvent(admin, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      workflowRequestId: request.id,
      eventType: "cancelled",
      payload: { operatorUserId: input.operatorUserId },
    })
  }

  return { ok: true, decision: updatedDecision }
}

export async function completeRevenueDirectorWorkflowRequest(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workflowRequestId: string
    occurredAt: string
    operatorUserId?: string
  },
): Promise<
  | { ok: true; workflowRequest: GrowthRevenueDirectorWorkflowRequestRecord }
  | { ok: false; error: string; message: string }
> {
  const schemaReady = await isGrowthRevenueDirectorDecisionLedgerSchemaReady(admin)
  if (!schemaReady) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(),
    }
  }

  const request = await fetchRevenueDirectorWorkflowRequestById(admin, {
    organizationId: input.organizationId,
    workflowRequestId: input.workflowRequestId,
  })
  if (!request) {
    return { ok: false, error: "workflow_request_not_found", message: "Workflow request not found." }
  }
  if (!canTransitionWorkflowRequestStatus(request.status, "completed")) {
    return {
      ok: false,
      error: "invalid_transition",
      message: `Cannot complete workflow request in status ${request.status}.`,
    }
  }

  const updated = await updateRevenueDirectorWorkflowRequestStatus(admin, {
    organizationId: input.organizationId,
    workflowRequestId: request.id,
    status: "completed",
    completedAt: input.occurredAt,
  })

  await insertRevenueDirectorDecisionEvent(admin, {
    organizationId: input.organizationId,
    decisionId: request.decisionId,
    workflowRequestId: request.id,
    eventType: "completed",
    payload: { operatorUserId: input.operatorUserId ?? null, dispatchBlocked: true },
  })

  await publishLedgerEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES.workflowRequestCompleted,
    subjectId: request.id,
    payload: { workflowRequestId: request.id, decisionId: request.decisionId, dispatched: false },
    occurredAt: input.occurredAt,
  })

  return { ok: true, workflowRequest: updated }
}
