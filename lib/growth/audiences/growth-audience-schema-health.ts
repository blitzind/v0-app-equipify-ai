import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUDIENCE_QA_MARKER,
  GROWTH_AUDIENCE_SCHEMA_MIGRATION,
} from "@/lib/growth/audiences/growth-audience-config"

export const GROWTH_AUDIENCE_SCHEMA_TABLES = [
  "growth.growth_audiences",
  "growth.growth_audience_snapshots",
  "growth.growth_audience_members",
  "growth.growth_audience_refresh_runs",
] as const

export { GROWTH_AUDIENCE_SCHEMA_MIGRATION, GROWTH_AUDIENCE_QA_MARKER }

export const GROWTH_AUDIENCE_SCHEMA_SETUP_MESSAGE =
  "Dynamic audience schema is not ready. Apply migration 20270901140000_growth_dynamic_audiences_gs_rg_2a.sql."

export async function probeAudienceTable(
  admin: SupabaseClient,
  table: string,
): Promise<{ missing: boolean }> {
  const shortName = table.replace("growth.", "")
  const { error } = await admin.schema("growth").from(shortName).select("id").limit(1)
  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return { missing: true }
  }
  return { missing: false }
}

export async function isGrowthAudienceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeAudienceTable(admin, "growth_audiences")
  return !probe.missing
}
