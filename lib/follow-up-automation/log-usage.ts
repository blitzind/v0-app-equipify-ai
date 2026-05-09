import type { SupabaseClient } from "@supabase/supabase-js"

export type FollowUpAutomationUsageEventType =
  | "evaluation_run"
  | "draft_generated"
  | "approved"
  | "dismissed"
  | "handoff"

export async function logFollowUpAutomationUsage(params: {
  supabase: SupabaseClient
  organizationId: string
  userId: string | null
  eventType: FollowUpAutomationUsageEventType
  metadata?: Record<string, unknown>
}): Promise<void> {
  await params.supabase.from("follow_up_automation_usage_events").insert({
    organization_id: params.organizationId,
    event_type: params.eventType,
    user_id: params.userId,
    metadata: params.metadata ?? {},
  })
}
