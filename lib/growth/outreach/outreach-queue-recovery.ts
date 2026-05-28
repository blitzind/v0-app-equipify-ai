import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import {
  classifyProviderFailure,
  isRetryEligibleFailureClass,
} from "@/lib/growth/outbound/provider-failure-classifier"
import {
  GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES,
  type GrowthOutreachQueueRecoveryItem,
  type GrowthProviderFailureClass,
} from "@/lib/growth/outbound/outbound-reliability-types"
import { executeGrowthOutreachQueueItem } from "@/lib/growth/outreach/execute-outreach"
import { runOutreachExecutionGuard } from "@/lib/growth/outreach/outreach-execution-guard"
import {
  fetchGrowthOutreachQueueItem,
  insertGrowthOutreachQueueEvent,
  listGrowthOutreachQueueItemsWithLead,
  updateGrowthOutreachQueueItem,
} from "@/lib/growth/outreach/outreach-queue-repository"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"

function mapRecoveryItem(
  row: GrowthOutreachQueueItem & { companyName?: string },
  failureClass: GrowthProviderFailureClass | null,
  retryCount: number,
  deadLetterAt: string | null,
): GrowthOutreachQueueRecoveryItem {
  return {
    queue_id: row.id,
    lead_id: row.leadId,
    channel: row.channel,
    status: row.status,
    failure_reason: row.failureReason,
    failure_class: failureClass,
    retry_count: retryCount,
    retry_eligible:
      isRetryEligibleFailureClass(failureClass) && retryCount < GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES,
    dead_letter_at: deadLetterAt,
    failed_at: row.failedAt,
    scheduled_for: row.scheduledFor,
    delivery_attempt_id: row.deliveryAttemptId ?? null,
    company_name: row.companyName,
  }
}

export async function markOutreachQueueFailure(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    reason: string
    code?: string | null
    blockCode?: string | null
    actingUserId?: string | null
    deliveryAttemptId?: string | null
  },
): Promise<GrowthOutreachQueueItem> {
  const classification = classifyProviderFailure({
    message: input.reason,
    code: input.code,
    blockCode: input.blockCode,
  })
  const now = new Date().toISOString()
  const retryCount = (input.queueItem.retryCount ?? 0) + 1
  const deadLetter =
    !classification.retry_eligible || retryCount >= GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES

  const updated = await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
    status: deadLetter ? "dead_letter" : "failed",
    failedAt: now,
    failureReason: input.reason.slice(0, 500),
    failureClass: classification.failure_class,
    retryCount,
    deadLetterAt: deadLetter ? now : null,
    processingStartedAt: null,
    deliveryAttemptId: input.deliveryAttemptId ?? input.queueItem.deliveryAttemptId ?? null,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: input.queueItem.id,
    eventType: deadLetter ? "dead_lettered" : "failed",
    actorUserId: input.actingUserId ?? null,
    metadata: {
      reason: input.reason,
      failure_class: classification.failure_class,
      retry_count: retryCount,
    },
  })

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "pre_send_blocked",
    severity: deadLetter ? "critical" : "high",
    title: deadLetter ? "Outreach dead-lettered" : "Outreach execution failed",
    summary: input.reason,
    deliveryAttemptId: input.deliveryAttemptId ?? undefined,
    metadata: {
      queue_id: input.queueItem.id,
      failure_class: classification.failure_class,
      retry_count: retryCount,
    },
  }).catch(() => undefined)

  return updated
}

export async function listOutreachQueueRecoveryItems(
  admin: SupabaseClient,
  limit = 25,
): Promise<GrowthOutreachQueueRecoveryItem[]> {
  const rows = await listGrowthOutreachQueueItemsWithLead(admin, {
    statuses: ["failed", "dead_letter"],
    limit,
  })

  return rows.map((row) =>
    mapRecoveryItem(row, row.failureClass ?? null, row.retryCount ?? 0, row.deadLetterAt ?? null),
  )
}

export async function replayGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthOutreachQueueItem> {
  const existing = await fetchGrowthOutreachQueueItem(admin, input.queueId)
  if (!existing) throw new Error("not_found")
  if (!["failed", "dead_letter"].includes(existing.status)) throw new Error("invalid_status")

  const failureClass = existing.failureClass ?? null
  const retryCount = existing.retryCount ?? 0
  if (!isRetryEligibleFailureClass(failureClass)) throw new Error("not_retry_eligible")
  if (retryCount >= GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES) throw new Error("retry_limit_exceeded")
  if (!existing.approvedAt || !existing.approvedBy) throw new Error("approval_required")

  const lead = await fetchGrowthLeadById(admin, existing.leadId)
  if (!lead) throw new Error("not_found")

  let generationType = null
  let generationApproved = !existing.generationId
  if (existing.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, existing.generationId)
    if (!generation || generation.status !== "approved") throw new Error("generation_not_approved")
    generationType = generation.generationType
    generationApproved = true
  }

  const guard = await runOutreachExecutionGuard(admin, {
    queueItem: existing,
    lead,
    generationType,
    generationApproved,
  })
  if (!guard.allowed) throw new Error(guard.code ?? "preflight_blocked")

  const now = new Date().toISOString()
  const reset = await updateGrowthOutreachQueueItem(admin, existing.id, {
    status: "approved",
    failedAt: null,
    failureReason: null,
    failureClass: null,
    deadLetterAt: null,
    processingStartedAt: null,
    lastRetryAt: now,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: existing.id,
    eventType: "replay_requested",
    actorUserId: input.actingUserId,
    metadata: { retry_count: retryCount + 1 },
  })

  return executeGrowthOutreachQueueItem(admin, {
    queueItem: reset,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })
}

export async function cancelFailedOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueId: string
    actingUserId: string
    reason?: string | null
  },
): Promise<GrowthOutreachQueueItem> {
  const existing = await fetchGrowthOutreachQueueItem(admin, input.queueId)
  if (!existing) throw new Error("not_found")
  if (!["failed", "dead_letter"].includes(existing.status)) throw new Error("invalid_status")

  const now = new Date().toISOString()
  const updated = await updateGrowthOutreachQueueItem(admin, input.queueId, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: input.actingUserId,
    failureReason: input.reason ?? existing.failureReason,
    processingStartedAt: null,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: input.queueId,
    eventType: "cancelled",
    actorUserId: input.actingUserId,
    metadata: { reason: input.reason ?? "Operator cancelled failed item." },
  })

  return updated
}

export async function runOutreachPreflightForQueueItem(
  admin: SupabaseClient,
  queueId: string,
): Promise<{ allowed: boolean; reason?: string; code?: string; failure_class?: GrowthProviderFailureClass }> {
  const item = await fetchGrowthOutreachQueueItem(admin, queueId)
  if (!item) throw new Error("not_found")
  const lead = await fetchGrowthLeadById(admin, item.leadId)
  if (!lead) throw new Error("not_found")

  const guard = await runOutreachExecutionGuard(admin, {
    queueItem: item,
    lead,
    generationApproved: !item.generationId,
  })

  if (!guard.allowed) {
    const classification = classifyProviderFailure({ message: guard.reason, code: guard.code, blockCode: guard.blockCode })
    return {
      allowed: false,
      reason: guard.reason,
      code: guard.code,
      failure_class: classification.failure_class,
    }
  }

  return { allowed: true }
}
