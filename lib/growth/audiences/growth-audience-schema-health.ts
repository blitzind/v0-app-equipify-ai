import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUDIENCE_2B_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_2C_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_QA_MARKER,
  GROWTH_AUDIENCE_SCHEMA_MIGRATION,
} from "@/lib/growth/audiences/growth-audience-config"

export const GROWTH_AUDIENCE_SCHEMA_TABLES = [
  "growth.growth_audiences",
  "growth.growth_audience_snapshots",
  "growth.growth_audience_members",
  "growth.growth_audience_refresh_runs",
  "growth.growth_audience_snapshot_diffs",
  "growth.growth_audience_member_diffs",
  "growth.growth_audience_lead_creation_runs",
  "growth.growth_audience_enrollment_previews",
  "growth.growth_audience_enrollment_preview_members",
  "growth.growth_audience_enrollment_runs",
] as const

export {
  GROWTH_AUDIENCE_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_2B_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_2C_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_QA_MARKER,
}

export const GROWTH_AUDIENCE_SCHEMA_SETUP_MESSAGE =
  "Dynamic audience schema is not ready. Apply migrations 20270901140000 (GS-RG-2A), 20270901150000 (GS-RG-2B), and 20270901160000 (GS-RG-2C)."

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

export async function isGrowthAudience2BSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeAudienceTable(admin, "growth_audience_snapshot_diffs")
  return !probe.missing
}
