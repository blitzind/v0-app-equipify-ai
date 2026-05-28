import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyReputationSafeScheduleGate } from "@/lib/growth/outbound/reputation-safe-scheduler"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import { runGrowthOutreachPreflight, type OutreachPreflightResult } from "@/lib/growth/outreach/outreach-preflight"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"

export type OutreachExecutionGuardResult =
  | { allowed: true; senderAccountId: string | null }
  | { allowed: false; reason: string; code: string; blockCode?: string | null }

export async function runOutreachExecutionGuard(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    lead: GrowthLead
    generationType?: GrowthAiCopilotGenerationType | null
    generationApproved?: boolean
  },
): Promise<OutreachExecutionGuardResult> {
  const sender = await resolveSequenceExecutionSender(admin).catch(() => null)
  const senderAccountId = sender?.senderAccountId ?? null

  const preflight: OutreachPreflightResult = await runGrowthOutreachPreflight(admin, {
    lead: input.lead,
    channel: input.queueItem.channel,
    toEmail: input.queueItem.payloadSnapshot.toEmail ?? input.lead.contactEmail,
    generationType: input.generationType,
    generationApproved: input.generationApproved,
    senderAccountId,
  })

  if (!preflight.allowed) {
    return {
      allowed: false,
      reason: preflight.reason ?? "Outreach preflight blocked send.",
      code: preflight.code ?? "preflight_blocked",
    }
  }

  if (input.queueItem.channel === "email") {
    const domain =
      (input.queueItem.payloadSnapshot.toEmail ?? input.lead.contactEmail)?.split("@")[1]?.toLowerCase() ?? null
    const gate = await applyReputationSafeScheduleGate(admin, {
      entityType: "outreach_queue",
      entityId: input.queueItem.id,
      senderAccountId,
      domain,
      priority: input.queueItem.priority,
    })

    if (!gate.proceed) {
      return {
        allowed: false,
        reason: gate.result.reasons.join("; ") || "Blocked by reputation-safe scheduler.",
        code: gate.result.decision === "defer" ? "reputation_deferred" : "reputation_blocked",
        blockCode: "reputation_blocked",
      }
    }
  }

  return { allowed: true, senderAccountId }
}
