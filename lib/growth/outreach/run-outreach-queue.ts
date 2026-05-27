import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  computeOutreachExecutionConfidence,
  deriveOutreachQueuePriority,
} from "@/lib/growth/outreach/outreach-analytics"
import { executeGrowthOutreachQueueItem } from "@/lib/growth/outreach/execute-outreach"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  insertGrowthOutreachQueueEvent,
  insertGrowthOutreachQueueItem,
  listGrowthOutreachQueueItems,
  updateGrowthOutreachQueueItem,
} from "@/lib/growth/outreach/outreach-queue-repository"
import type {
  GrowthOutreachQueueChannel,
  GrowthOutreachQueueItem,
  GrowthOutreachQueuePayloadSnapshot,
} from "@/lib/growth/outreach/outreach-queue-types"
import { fetchGrowthOutreachSettings } from "@/lib/growth/outreach/outreach-settings-repository"
import { resolveScheduledFor } from "@/lib/growth/outreach/outreach-scheduling"
import { applyReputationSafeScheduleGate } from "@/lib/growth/outbound/reputation-safe-scheduler"
import {
  emitGrowthLeadOutreachApprovedTimeline,
  emitGrowthLeadOutreachCancelledTimeline,
  emitGrowthLeadOutreachQueuedTimeline,
} from "@/lib/growth/timeline-emitter"

function buildPayloadFromGeneration(generation: {
  generatedContent: string
  generatedSubject: string | null
  generationType: string
  promptVersion: string
  promptVariant: string
  inputHash: string | null
  classification?: Record<string, unknown>
}): GrowthOutreachQueuePayloadSnapshot {
  const personalization = generation.classification?.personalization as
    | { variationKey?: string; strategyVersion?: string; confidenceScore?: number }
    | undefined
  return {
    subject: generation.generatedSubject,
    body: generation.generatedContent,
    generationType: generation.generationType,
    promptVersion: generation.promptVersion,
    promptVariant: generation.promptVariant,
    inputHash: generation.inputHash,
    variantKey: personalization?.variationKey ?? null,
    personalizationStrategyVersion: personalization?.strategyVersion ?? generation.promptVersion,
    personalizationConfidence: personalization?.confidenceScore ?? null,
  }
}

export async function createGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    leadId: string
    generationId?: string | null
    channel?: GrowthOutreachQueueChannel
    createdBy: string
    actingUserEmail: string
    providerConnectionId?: string | null
    parentQueueId?: string | null
    generationVersion?: number
  },
): Promise<GrowthOutreachQueueItem> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  let payload: GrowthOutreachQueuePayloadSnapshot = {}
  let generationId = input.generationId ?? null

  if (generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, generationId)
    if (!generation || generation.leadId !== input.leadId) throw new Error("not_found")
    if (generation.status !== "approved") throw new Error("generation_not_approved")
    payload = {
      ...buildPayloadFromGeneration(generation),
      toEmail: lead.contactEmail,
    }
  }

  const channel = input.channel ?? "email"
  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel,
    toEmail: payload.toEmail ?? lead.contactEmail,
    generationType: (payload.generationType as never) ?? null,
    generationApproved: Boolean(generationId),
  })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  const existing = await listGrowthOutreachQueueItems(admin, {
    leadId: input.leadId,
    generationId: generationId ?? undefined,
    status: ["pending_approval", "approved", "scheduled"],
    limit: 1,
  })
  if (existing.length > 0) throw new Error("already_queued")

  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  const item = await insertGrowthOutreachQueueItem(admin, {
    leadId: input.leadId,
    generationId,
    channel,
    status: "pending_approval",
    priority: deriveOutreachQueuePriority({
      callPriorityTier: lead.callPriorityTier,
      executivePriorityTier: lead.executivePriorityTier,
    }),
    executionConfidence: computeOutreachExecutionConfidence({
      leadScore: lead.score,
      engagementScore: lead.engagementScore,
      capacityTier: lead.operationalCapacityTier,
      channel,
    }),
    providerConnectionId: input.providerConnectionId ?? settings.activeEmailConnectionId,
    payloadSnapshot: payload,
    parentQueueId: input.parentQueueId ?? null,
    generationVersion: input.generationVersion ?? 1,
    createdBy: input.createdBy,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: item.id,
    eventType: "queued",
    actorUserId: input.createdBy,
  })

  await emitGrowthLeadOutreachQueuedTimeline(admin, {
    leadId: lead.id,
    queueId: item.id,
    channel: item.channel,
    summary: payload.subject ?? item.channel,
    actor: { userId: input.createdBy, email: input.actingUserEmail },
  })

  return item
}

export async function approveGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueId: string
    approvedBy: string
    actingUserEmail: string
    approvalNote?: string | null
    sendNow?: boolean
    scheduledFor?: string | null
  },
): Promise<GrowthOutreachQueueItem> {
  const { fetchGrowthOutreachQueueItem } = await import("@/lib/growth/outreach/outreach-queue-repository")
  const existing = await fetchGrowthOutreachQueueItem(admin, input.queueId)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "pending_approval" && existing.status !== "draft") {
    throw new Error("invalid_status")
  }

  const outreachSettings = await fetchGrowthOutreachSettings(admin)
  const schedule = resolveScheduledFor({
    sendNow: Boolean(input.sendNow),
    scheduledFor: input.scheduledFor,
    respectBusinessHours: outreachSettings.respectBusinessHours,
    timezone: outreachSettings.timezone,
    startMinutes: outreachSettings.businessHoursStartMinutes,
    endMinutes: outreachSettings.businessHoursEndMinutes,
  })

  const now = new Date().toISOString()
  const updated = await updateGrowthOutreachQueueItem(admin, input.queueId, {
    status: schedule.status === "scheduled" ? "scheduled" : "approved",
    approvedAt: now,
    approvedBy: input.approvedBy,
    approvalNote: input.approvalNote ?? null,
    scheduledFor: schedule.scheduledFor,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: updated.id,
    eventType: schedule.status === "scheduled" ? "scheduled" : "approved",
    actorUserId: input.approvedBy,
    metadata: { approvalNote: input.approvalNote ?? null, scheduledFor: schedule.scheduledFor },
  })

  await emitGrowthLeadOutreachApprovedTimeline(admin, {
    leadId: updated.leadId,
    queueId: updated.id,
    channel: updated.channel,
    summary: updated.approvalNote ?? updated.payloadSnapshot.subject ?? "Approved for outreach",
    actor: { userId: input.approvedBy, email: input.actingUserEmail },
  })

  if (input.sendNow && updated.status === "approved") {
    return executeGrowthOutreachQueueItem(admin, {
      queueItem: updated,
      actingUserId: input.approvedBy,
      actingUserEmail: input.actingUserEmail,
    })
  }

  return updated
}

export async function cancelGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueId: string
    cancelledBy: string
    actingUserEmail: string
    reason?: string | null
  },
): Promise<GrowthOutreachQueueItem> {
  const { fetchGrowthOutreachQueueItem } = await import("@/lib/growth/outreach/outreach-queue-repository")
  const existing = await fetchGrowthOutreachQueueItem(admin, input.queueId)
  if (!existing) throw new Error("not_found")
  if (["executed", "cancelled"].includes(existing.status)) throw new Error("invalid_status")

  const now = new Date().toISOString()
  const updated = await updateGrowthOutreachQueueItem(admin, input.queueId, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: input.cancelledBy,
    failureReason: input.reason ?? null,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: updated.id,
    eventType: "cancelled",
    actorUserId: input.cancelledBy,
    metadata: { reason: input.reason ?? null },
  })

  await emitGrowthLeadOutreachCancelledTimeline(admin, {
    leadId: updated.leadId,
    queueId: updated.id,
    channel: updated.channel,
    summary: input.reason ?? "Outreach cancelled",
    actor: { userId: input.cancelledBy, email: input.actingUserEmail },
  })

  return updated
}

export async function runDueScheduledOutreachExecutions(
  admin: SupabaseClient,
  input: { actingUserId: string; actingUserEmail: string; limit?: number },
): Promise<{ executed: number; failed: number }> {
  const { listDueScheduledOutreachQueueItems } = await import("@/lib/growth/outreach/outreach-queue-repository")
  const due = await listDueScheduledOutreachQueueItems(admin, input.limit ?? 25)
  let executed = 0
  let failed = 0

  for (const item of due) {
    try {
      const domain = item.payloadSnapshot.toEmail?.split("@")[1]?.toLowerCase() ?? null
      const gate = await applyReputationSafeScheduleGate(admin, {
        entityType: "outreach_queue",
        entityId: item.id,
        domain,
        priority: item.priority,
      })
      if (!gate.proceed) {
        if (gate.result.decision === "defer" && gate.result.deferredUntil) {
          await updateGrowthOutreachQueueItem(admin, item.id, {
            status: "scheduled",
            scheduledFor: gate.result.deferredUntil,
            failureReason: gate.result.reasons.join("; ") || "Deferred by reputation-safe scheduler",
          })
        } else {
          await updateGrowthOutreachQueueItem(admin, item.id, {
            status: "failed",
            failedAt: new Date().toISOString(),
            failureReason: gate.result.reasons.join("; ") || "Skipped by reputation-safe scheduler",
          })
          failed += 1
        }
        continue
      }

      await executeGrowthOutreachQueueItem(admin, {
        queueItem: item,
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
      })
      executed += 1
    } catch {
      failed += 1
    }
  }

  return { executed, failed }
}
