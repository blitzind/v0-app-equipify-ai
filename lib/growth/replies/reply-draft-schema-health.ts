import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_AI_REPLY_DRAFTING_SCHEMA_MIGRATION = "20270414120000_growth_ai_reply_drafting.sql" as const

export async function isGrowthAiReplyDraftingSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("inbox_reply_drafts").select("id").limit(1),
    admin.schema("growth").from("inbox_reply_draft_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
