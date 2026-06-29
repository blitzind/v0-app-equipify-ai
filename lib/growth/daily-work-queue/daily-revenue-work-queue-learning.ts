/**
 * GE-AIOS-SDR-2B/2C — Emit completed daily work queue outcomes via canonical revenue outcome.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkQueueItem } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { emitDailyWorkQueueRevenueOutcome } from "@/lib/growth/revenue-outcomes/revenue-outcome-runtime-bridge"

export { GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT }

function mapActionToLearningChannel(action: WorkQueueItem["action"]): string {
  switch (action) {
    case "send_email":
      return "email"
    case "place_call":
      return "call"
    case "launch_voice_drop":
      return "voice_drop"
    case "send_sms":
      return "sms"
    case "create_linkedin_task":
      return "linkedin_manual"
    case "send_video":
      return "video"
    case "schedule_meeting":
      return "call"
    default:
      return "email"
  }
}

export async function emitDailyWorkQueueCompletionLearningEvent(
  admin: SupabaseClient,
  input: {
    item: WorkQueueItem
    completedAt?: string
    outcome?: "completed" | "skipped" | "failed"
  },
): Promise<{ ok: boolean }> {
  emitDailyWorkQueueRevenueOutcome(admin, {
    leadId: input.item.leadId,
    companyId: input.item.companyId,
    channel: mapActionToLearningChannel(input.item.action),
    action: input.item.action,
    outcome: input.outcome ?? "completed",
    taskKey: input.item.taskKey,
    priority: input.item.priority,
    confidence: input.item.confidence,
    occurredAt: input.completedAt,
  })

  return { ok: true }
}
