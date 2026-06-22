import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGeV14DemoAssistantSessionsTable } from "@/lib/growth/demo-assistant/ge-v1-4-demo-session-repository"

export async function probeGeV14DemoAssistantSchemaReady(admin: SupabaseClient): Promise<boolean> {
  return probeGeV14DemoAssistantSessionsTable(admin)
}

export async function probeGeV14DemoAssistantEngagementEventsReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("growth_engagement_events")
    .select("id")
    .eq("event_type", "question_asked")
    .limit(1)

  if (error?.message?.includes("does not exist")) return false
  if (error?.message?.includes("violates check constraint")) return false
  return true
}
