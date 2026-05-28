import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLiveGuidancePriorityLabel } from "@/lib/growth/live-guidance/live-guidance-priority"
import {
  DEFAULT_OPERATOR_ASSIST_PREFERENCES,
  type OperatorAssistPreferencesPublicView,
  type UnifiedOperatorAssistCategory,
} from "@/lib/growth/operator-assist/types"

const PREFS_TABLE = "operator_assist_preferences"

function mapPreferences(row: Record<string, unknown>): OperatorAssistPreferencesPublicView {
  const enabled = (row.enabled_categories as Record<string, boolean> | null) ?? {}
  return {
    quietMode: Boolean(row.quiet_mode),
    minimumPriorityLabel: (row.minimum_priority_label as GrowthLiveGuidancePriorityLabel) ?? "Low",
    enabledCategories: {
      objection: enabled.objection ?? true,
      buying_signal: enabled.buying_signal ?? true,
      risk: enabled.risk ?? true,
      guidance: enabled.guidance ?? true,
      coaching: enabled.coaching ?? true,
      interruption: enabled.interruption ?? true,
      conversation: enabled.conversation ?? true,
    },
  }
}

export async function fetchOperatorAssistPreferences(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<OperatorAssistPreferencesPublicView> {
  const { data, error } = await admin
    .schema("growth")
    .from(PREFS_TABLE)
    .select("quiet_mode, minimum_priority_label, enabled_categories")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return DEFAULT_OPERATOR_ASSIST_PREFERENCES
    }
    throw new Error(error.message)
  }
  if (!data) return DEFAULT_OPERATOR_ASSIST_PREFERENCES
  return mapPreferences(data as Record<string, unknown>)
}

export async function upsertOperatorAssistPreferences(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    quietMode?: boolean
    minimumPriorityLabel?: GrowthLiveGuidancePriorityLabel
    enabledCategories?: Partial<Record<UnifiedOperatorAssistCategory, boolean>>
  },
): Promise<OperatorAssistPreferencesPublicView> {
  const existing = await fetchOperatorAssistPreferences(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })

  const enabledCategories = {
    ...existing.enabledCategories,
    ...input.enabledCategories,
  }

  const { data, error } = await admin
    .schema("growth")
    .from(PREFS_TABLE)
    .upsert(
      {
        organization_id: input.organizationId,
        user_id: input.userId,
        quiet_mode: input.quietMode ?? existing.quietMode,
        minimum_priority_label: input.minimumPriorityLabel ?? existing.minimumPriorityLabel,
        enabled_categories: enabledCategories,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("quiet_mode, minimum_priority_label, enabled_categories")
    .single()

  if (error) throw new Error(error.message)
  return mapPreferences(data as Record<string, unknown>)
}
