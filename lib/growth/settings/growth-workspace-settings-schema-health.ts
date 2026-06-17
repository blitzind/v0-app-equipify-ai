import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_WORKSPACE_SETTINGS_MIGRATION,
  GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
} from "@/lib/growth/settings/growth-workspace-settings-types"

export const GROWTH_WORKSPACE_SETTINGS_SCHEMA_SETUP_MESSAGE =
  `Operator workspace preferences table is not ready. Apply migration ${GROWTH_WORKSPACE_SETTINGS_MIGRATION}.`

export async function isGrowthWorkspaceSettingsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("operator_workspace_preferences").select("id").limit(1)
  return !error
}

export async function probeGrowthWorkspaceSettingsSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_WORKSPACE_SETTINGS_QA_MARKER
  ready: boolean
  error: string | null
}> {
  const ready = await isGrowthWorkspaceSettingsSchemaReady(admin)
  if (ready) {
    return { qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER, ready: true, error: null }
  }

  const { error } = await admin.schema("growth").from("operator_workspace_preferences").select("id").limit(1)

  return {
    qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
    ready: false,
    error: error?.message ?? GROWTH_WORKSPACE_SETTINGS_SCHEMA_SETUP_MESSAGE,
  }
}
