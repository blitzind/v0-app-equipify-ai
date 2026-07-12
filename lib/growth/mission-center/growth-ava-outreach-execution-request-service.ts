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
  GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT,
  type GrowthAvaOutreachExecutionRequest,
  type GrowthAvaOutreachPackageApprovalDecision,
  type GrowthAvaOutreachPackageApprovalResult,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"

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
  },
): Promise<void> {
  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
    correlationId: input.request.requestId,
    subjectType: "lead",
    subjectId: input.request.leadId,
    payload: {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      request_id: input.request.requestId,
      package_id: input.request.packageId,
      lead_id: input.request.leadId,
      execution_status: input.request.executionStatus,
      recommended_channel: input.request.recommendedChannel,
      recommended_cadence: input.request.recommendedCadence,
      sequence_job_id: input.request.sequenceJobId,
      detail: input.detail ?? null,
    },
  }).catch(() => undefined)
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
      package_id: input.packageId,
      lead_id: leadId,
      decision: input.decision,
      operator_user_id: input.operatorUserId,
      note: input.note ?? null,
      approved_at: now,
    },
  }).catch(() => undefined)

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
    executionStatus: "pending_fulfillment",
    sequenceJobId: null,
    sequenceEnrollmentId: null,
    sequenceStepId: null,
    fulfillmentError: null,
    fulfilledAt: null,
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

  executionRequest = await fulfillAvaOutreachExecutionRequestViaSequence(admin, {
    request: executionRequest,
    actingUserId: input.operatorUserId,
    actingUserEmail: input.operatorEmail,
  })

  await persistExecutionRequest(admin, executionRequest)
  await publishExecutionRequestEvent(admin, {
    organizationId: input.organizationId,
    request: executionRequest,
    detail: executionRequest.fulfillmentError,
  })

  logGrowthEngine("ava_outreach_package_approved", {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    package_id: input.packageId,
    lead_id: leadId,
    request_id: requestId,
    execution_status: executionRequest.executionStatus,
    sequence_job_id: executionRequest.sequenceJobId,
  })

  return {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    decision: input.decision,
    packageId: input.packageId,
    leadId,
    executionRequest,
  }
}
