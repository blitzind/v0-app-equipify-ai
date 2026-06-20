import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_SCHEMA_MIGRATION } from "@/lib/growth/sendr/growth-sendr-config"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

export { GROWTH_SENDR_SCHEMA_MIGRATION }

export const GROWTH_SENDR_TABLES = [
  "growth_media_assets",
  "growth_media_asset_versions",
  "growth_media_asset_access_logs",
  "growth_landing_pages",
  "growth_landing_page_sections",
  "growth_landing_page_publications",
  "growth_video_assets",
  "growth_video_asset_events",
  "growth_conversation_agents",
  "growth_conversation_agent_versions",
  "growth_booking_assets",
  "growth_booking_events",
  "growth_engagement_events",
  "growth_engagement_event_rollups",
] as const

export type GrowthSendrTableName = (typeof GROWTH_SENDR_TABLES)[number]

export async function probeSendrTable(
  admin: SupabaseClient,
  table: GrowthSendrTableName,
) {
  return probeRuntimeTable(admin, table)
}

export async function probeSendrSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const core: GrowthSendrTableName[] = [
    "growth_media_assets",
    "growth_landing_pages",
    "growth_engagement_events",
  ]
  for (const table of core) {
    const probe = await probeSendrTable(admin, table)
    if (probe.missing) return false
  }
  return true
}
