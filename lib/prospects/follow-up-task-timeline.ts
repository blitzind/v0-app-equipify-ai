import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logCommunicationEvent } from "@/lib/notifications/log-event"

/** Logs a prospect timeline row when Phase 23 follow-up automation tasks are reviewed (no sending). */
export async function logProspectFollowUpAutomationReview(args: {
  supabase: SupabaseClient
  organizationId: string
  prospectId: string
  ruleKey: string
  taskId: string
  action: "approved" | "dismissed" | "handoff"
  userId: string
  extraSummary?: string | null
}): Promise<void> {
  const title =
    args.action === "approved"
      ? "Automation follow-up approved"
      : args.action === "dismissed"
        ? "Automation follow-up dismissed"
        : "Automation follow-up queued to Communications"

  const summary =
    args.extraSummary?.trim() ||
    (args.action === "handoff"
      ? "Follow-up draft handed off for manual send from Communications."
      : args.action === "approved"
        ? "Automation draft approved for review."
        : "Automation suggestion dismissed.")

  try {
    await logCommunicationEvent(args.supabase, {
      organizationId: args.organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_follow_up_automation_review",
      title,
      summary,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: args.prospectId,
      provider: "internal",
      metadata: {
        follow_up_task_id: args.taskId,
        rule_key: args.ruleKey,
        action: args.action,
      },
      sentAt: new Date().toISOString(),
      createdBy: args.userId,
    })
  } catch {
    /* best-effort — same pattern as status-events */
  }
}
