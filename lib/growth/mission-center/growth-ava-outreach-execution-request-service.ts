/** GE-AVA-AUTONOMY-EXECUTION-REQUEST-1 — Execution Request orchestrator (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  findAutonomousOutreachPreparationRunByPackageId,
  markAutonomousOutreachPackageApprovalDecision,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  fulfillAvaOutreachExecutionRequestViaSequence,
  normalizeRecommendedChannel,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_FEATURE_FLAG,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
  GROWTH_AVA_OUTREACH_EXECUTION_RETRY_EVENT,
  GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT,
  type GrowthAvaOutreachExecutionRequest,
  type GrowthAvaOutreachExecutionRequestRetryRecord,
  type GrowthAvaOutreachPackageApprovalDecision,
  type GrowthAvaOutreachPackageApprovalResult,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import {
  freezeOperatorApprovedPackageAssets,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence-service"
import type { SendPlane1BEditablePackageChannel } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import {
  ensureApprovedPackageSequenceHandoffForLead,
  evaluateAvaOutreachExecutionReadinessForPackage,
} from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f"
import { GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"

export function isAvaOutreachExecutionRequestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_FEATURE_FLAG]?.trim() === "true"
}

function readExecutionRequests(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, GrowthAvaOutreachExecutionRequest> {
  const raw = metadata?.[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const record = raw as Record<string, unknown>
  const entries: Record<string, GrowthAvaOutreachExecutionRequest> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const item = value as Record<string, unknown>
    if (item.qa_marker !== GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER) continue
    entries[key] = item as GrowthAvaOutreachExecutionRequest
  }
  return entries
}

async function persistExecutionRequest(
  admin: SupabaseClient,
  request: GrowthAvaOutreachExecutionRequest,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, request.leadId)
  if (!lead) return

  const existing = readExecutionRequests(lead.metadata)
  await admin
    .schema("growth")
    .from("leads")
    .update({
      metadata: {
        ...(lead.metadata ?? {}),
        [GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY]: {
          ...existing,
          [request.requestId]: request,
        },
      },
    })
    .eq("id", request.leadId)
}

export async function fetchAvaOutreachExecutionRequestByPackageId(
  admin: SupabaseClient,
  input: { leadId: string; packageId: string },
): Promise<GrowthAvaOutreachExecutionRequest | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null
  const requests = Object.values(readExecutionRequests(lead.metadata))
  return requests.find((request) => request.packageId === input.packageId) ?? null
}

export async function fetchAvaOutreachExecutionRequestById(
  admin: SupabaseClient,
  input: { leadId: string; requestId: string },
): Promise<GrowthAvaOutreachExecutionRequest | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null
  return readExecutionRequests(lead.metadata)[input.requestId] ?? null
}

export async function fetchAvaOutreachExecutionRequestsForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthAvaOutreachExecutionRequest[]> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return []
  return Object.values(readExecutionRequests(lead.metadata)).sort((a, b) =>
    b.approvedAt.localeCompare(a.approvedAt),
  )
}

async function publishExecutionRequestEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    request: GrowthAvaOutreachExecutionRequest
    detail?: string | null
    operatorUserId?: string | null
  },
): Promise<void> {
  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
    category: "approval",
    producer: "growth_ava_outreach_execution_request",
    source: "growth_ava_outreach_execution_request_service",
    correlationId: input.request.requestId,
    entityType: "lead",
    entityId: input.request.leadId,
    payload: {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      request_id: input.request.requestId,
      package_id: input.request.packageId,
      lead_id: input.request.leadId,
      operator_user_id: input.operatorUserId ?? input.request.approvedBy,
      execution_status: input.request.executionStatus,
      recommended_channel: input.request.recommendedChannel,
      recommended_cadence: input.request.recommendedCadence,
      sequence_pattern_id: input.request.sequencePatternId,
      sequence_job_id: input.request.sequenceJobId,
      detail: input.detail ?? input.request.fulfillmentError ?? null,
      approved_at: input.request.approvedAt,
      fulfilled_at: input.request.fulfilledAt,
    },
  })
}

async function publishExecutionRetryEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    request: GrowthAvaOutreachExecutionRequest
    retry: GrowthAvaOutreachExecutionRequestRetryRecord
    operatorUserId: string
  },
): Promise<void> {
  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AVA_OUTREACH_EXECUTION_RETRY_EVENT,
    category: "approval",
    producer: "growth_ava_outreach_execution_request",
    source: "growth_ava_outreach_execution_request_service",
    correlationId: input.request.requestId,
    entityType: "lead",
    entityId: input.request.leadId,
    payload: {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      request_id: input.request.requestId,
      package_id: input.request.packageId,
      lead_id: input.request.leadId,
      operator_user_id: input.operatorUserId,
      retry: input.retry,
    },
  })
}

export async function submitAvaOutreachPackageApprovalAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    decision: GrowthAvaOutreachPackageApprovalDecision
    operatorUserId: string
    operatorEmail: string
    note?: string | null
    draftEdits?: Partial<Record<SendPlane1BEditablePackageChannel, string>>
  },
): Promise<GrowthAvaOutreachPackageApprovalResult> {
  if (!isAvaOutreachExecutionRequestEnabled()) {
    throw new Error("ava_outreach_execution_request_disabled")
  }

  const run = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    input.organizationId,
    input.packageId,
  )
  const pkg = run?.approvalPackage
  if (!run || !pkg) {
    throw new Error("outreach_package_not_found")
  }
  if (pkg.packageApprovalDecision) {
    throw new Error("outreach_package_already_decided")
  }

  const leadId = pkg.leadId
  const existing = await fetchAvaOutreachExecutionRequestByPackageId(admin, {
    leadId,
    packageId: input.packageId,
  })
  if (existing) {
    throw new Error("execution_request_already_exists")
  }

  const now = new Date().toISOString()

  const { ensureGrowthAiEventBusInProcessSubscribers } = await import(
    "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
  )
  ensureGrowthAiEventBusInProcessSubscribers()

  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT,
    category: "approval",
    producer: "growth_ava_outreach_execution_request",
    source: "growth_ava_outreach_execution_request_service",
    correlationId: input.packageId,
    entityType: "lead",
    entityId: leadId,
    payload: {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      package_id: input.packageId,
      lead_id: leadId,
      decision: input.decision,
      operator_user_id: input.operatorUserId,
      note: input.note ?? null,
      approved_at: now,
    },
  })

  if (input.decision === "reject") {
    await markAutonomousOutreachPackageApprovalDecision({
      admin,
      organizationId: input.organizationId,
      packageId: input.packageId,
      decision: "rejected",
      now,
    })

    logGrowthEngine("ava_outreach_package_rejected", {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      package_id: input.packageId,
      lead_id: leadId,
    })

    return {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      decision: input.decision,
      packageId: input.packageId,
      leadId,
      executionRequest: null,
    }
  }

  const readiness = await evaluateAvaOutreachExecutionReadinessForPackage(admin, {
    leadId,
    recommendedSequence: pkg.recommendedSequence,
    recommendedChannel: pkg.recommendedChannel,
  })

  if (!pkg.generatedAssets?.length) {
    throw new Error("package_incomplete")
  }

  await freezeOperatorApprovedPackageAssets(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    approvedAt: now,
    draftEdits: input.draftEdits,
    operatorUserId: input.operatorUserId,
  })

  if (!readiness.executionReady) {
    await markAutonomousOutreachPackageApprovalDecision({
      admin,
      organizationId: input.organizationId,
      packageId: input.packageId,
      decision: "approved",
      executionRequestId: null,
      now,
    })

    logGrowthEngine("ava_outreach_package_approved", {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      package_id: input.packageId,
      lead_id: leadId,
      request_id: null,
      execution_status: "pending_execution_setup",
      sequence_job_id: null,
      sequence_pattern_id: null,
    })

    return {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      decision: input.decision,
      packageId: input.packageId,
      leadId,
      executionRequest: null,
    }
  }

  const requestId = randomUUID()

  let executionRequest: GrowthAvaOutreachExecutionRequest = {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    requestId,
    organizationId: input.organizationId,
    leadId,
    packageId: input.packageId,
    approvedBy: input.operatorUserId,
    approvedAt: now,
    recommendedChannel: normalizeRecommendedChannel(pkg.recommendedChannel),
    recommendedCadence: pkg.recommendedSequence ?? null,
    sequencePatternId: null,
    executionStatus: "pending_fulfillment",
    sequenceJobId: null,
    sequenceEnrollmentId: null,
    sequenceStepId: null,
    fulfillmentError: null,
    fulfilledAt: null,
    retryHistory: [],
  }

  await persistExecutionRequest(admin, executionRequest)

  await markAutonomousOutreachPackageApprovalDecision({
    admin,
    organizationId: input.organizationId,
    packageId: input.packageId,
    decision: "approved",
    executionRequestId: requestId,
    now,
  })

  const handoff = await ensureApprovedPackageSequenceHandoffForLead(admin, {
    leadId,
    packageId: input.packageId,
    recommendedSequence: pkg.recommendedSequence,
    recommendedChannel: pkg.recommendedChannel,
    executionRequestId: requestId,
  })

  executionRequest = {
    ...executionRequest,
    sequencePatternId: handoff.patternId,
  }

  executionRequest = await fulfillAvaOutreachExecutionRequestViaSequence(admin, {
    request: executionRequest,
    actingUserId: input.operatorUserId,
    actingUserEmail: input.operatorEmail,
    sequencePatternId: handoff.patternId,
  })

  await persistExecutionRequest(admin, executionRequest)
  await publishExecutionRequestEvent(admin, {
    organizationId: input.organizationId,
    request: executionRequest,
    detail: executionRequest.fulfillmentError,
    operatorUserId: input.operatorUserId,
  })

  logGrowthEngine("ava_outreach_package_approved", {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
    package_id: input.packageId,
    lead_id: leadId,
    request_id: requestId,
    execution_status: executionRequest.executionStatus,
    sequence_job_id: executionRequest.sequenceJobId,
    sequence_pattern_id: executionRequest.sequencePatternId,
  })

  return {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    decision: input.decision,
    packageId: input.packageId,
    leadId,
    executionRequest,
  }
}

export async function retryAvaOutreachExecutionRequestFulfillment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    requestId: string
    operatorUserId: string
    operatorEmail: string
  },
): Promise<GrowthAvaOutreachExecutionRequest> {
  if (!isAvaOutreachExecutionRequestEnabled()) {
    throw new Error("ava_outreach_execution_request_disabled")
  }

  const existing = await fetchAvaOutreachExecutionRequestById(admin, {
    leadId: input.leadId,
    requestId: input.requestId,
  })
  if (!existing) {
    throw new Error("execution_request_not_found")
  }
  if (existing.organizationId !== input.organizationId) {
    throw new Error("execution_request_not_found")
  }
  if (existing.executionStatus === "queued" && existing.sequenceJobId) {
    throw new Error("execution_request_already_fulfilled")
  }
  if (existing.executionStatus !== "failed") {
    throw new Error("execution_request_not_retryable")
  }

  const run = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    input.organizationId,
    existing.packageId,
  )
  const pkg = run?.approvalPackage
  if (!pkg || pkg.packageApprovalDecision !== "approved") {
    throw new Error("outreach_package_not_approved")
  }

  const handoff = await ensureApprovedPackageSequenceHandoffForLead(admin, {
    leadId: input.leadId,
    packageId: existing.packageId,
    recommendedSequence: pkg.recommendedSequence ?? existing.recommendedCadence,
    recommendedChannel: pkg.recommendedChannel,
    executionRequestId: existing.requestId,
    boundSequenceEnrollmentId: existing.sequenceEnrollmentId,
  })

  const priorStatus = existing.executionStatus
  const priorError = existing.fulfillmentError

  let retried = await fulfillAvaOutreachExecutionRequestViaSequence(admin, {
    request: {
      ...existing,
      sequencePatternId: handoff.patternId,
      executionStatus: "pending_fulfillment",
      fulfillmentError: null,
      fulfilledAt: null,
    },
    actingUserId: input.operatorUserId,
    actingUserEmail: input.operatorEmail,
    sequencePatternId: handoff.patternId,
  })

  const retryRecord: GrowthAvaOutreachExecutionRequestRetryRecord = {
    attemptedAt: new Date().toISOString(),
    operatorUserId: input.operatorUserId,
    priorExecutionStatus: priorStatus,
    priorFulfillmentError: priorError,
    resultExecutionStatus: retried.executionStatus,
    resultFulfillmentError: retried.fulfillmentError,
    sequencePatternId: handoff.patternId,
    sequenceJobId: retried.sequenceJobId,
  }

  retried = {
    ...retried,
    sequencePatternId: handoff.patternId,
    retryHistory: [...(existing.retryHistory ?? []), retryRecord],
  }

  await persistExecutionRequest(admin, retried)
  await publishExecutionRetryEvent(admin, {
    organizationId: input.organizationId,
    request: retried,
    retry: retryRecord,
    operatorUserId: input.operatorUserId,
  })
  await publishExecutionRequestEvent(admin, {
    organizationId: input.organizationId,
    request: retried,
    detail: retried.fulfillmentError,
    operatorUserId: input.operatorUserId,
  })

  logGrowthEngine("ava_outreach_execution_request_retried", {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    handoff_qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
    request_id: retried.requestId,
    package_id: retried.packageId,
    lead_id: retried.leadId,
    execution_status: retried.executionStatus,
    sequence_job_id: retried.sequenceJobId,
  })

  return retried
}
