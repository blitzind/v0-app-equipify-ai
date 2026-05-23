import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCommunicationUserOverrides } from "@/lib/growth/communication/scope"
import type { GrowthCallDialMode, GrowthPlatformAdminCommunicationPreferences } from "@/lib/growth/communication/types"

type PreferencesDbRow = {
  user_id: string
  call_dial_mode: string | null
  custom_url_template: string | null
  show_alternate_dialers: boolean | null
  preferred_email_connection_id: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "user_id, call_dial_mode, custom_url_template, show_alternate_dialers, preferred_email_connection_id, created_at, updated_at"

function preferencesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("user_communication_preferences")
}

function mapRow(row: PreferencesDbRow): GrowthPlatformAdminCommunicationPreferences {
  return {
    userId: row.user_id,
    callDialMode: row.call_dial_mode as GrowthCallDialMode | null,
    customUrlTemplate: row.custom_url_template,
    showAlternateDialers: row.show_alternate_dialers,
    preferredEmailConnectionId: row.preferred_email_connection_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toGrowthCommunicationUserOverrides(
  preferences: GrowthPlatformAdminCommunicationPreferences,
): GrowthCommunicationUserOverrides {
  return {
    callDialMode: preferences.callDialMode,
    customUrlTemplate: preferences.customUrlTemplate,
    showAlternateDialers: preferences.showAlternateDialers,
    preferredEmailConnectionId: preferences.preferredEmailConnectionId,
  }
}

/** Platform admin user overrides (`growth.user_communication_preferences`). Future org member overrides mirror this shape. */
export async function fetchGrowthPlatformAdminCommunicationPreferences(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthPlatformAdminCommunicationPreferences | null> {
  const { data, error } = await preferencesTable(admin).select(SELECT).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as PreferencesDbRow) : null
}

export async function upsertGrowthPlatformAdminCommunicationPreferences(
  admin: SupabaseClient,
  input: {
    userId: string
    callDialMode?: GrowthCallDialMode | null
    customUrlTemplate?: string | null
    showAlternateDialers?: boolean | null
    preferredEmailConnectionId?: string | null
  },
): Promise<GrowthPlatformAdminCommunicationPreferences> {
  const patch: Record<string, unknown> = {
    user_id: input.userId,
    updated_at: new Date().toISOString(),
  }

  if (input.callDialMode !== undefined) patch.call_dial_mode = input.callDialMode
  if (input.customUrlTemplate !== undefined) {
    patch.custom_url_template = input.customUrlTemplate?.trim() ? input.customUrlTemplate.trim() : null
  }
  if (input.showAlternateDialers !== undefined) patch.show_alternate_dialers = input.showAlternateDialers
  if (input.preferredEmailConnectionId !== undefined) {
    patch.preferred_email_connection_id = input.preferredEmailConnectionId
  }

  const { data, error } = await preferencesTable(admin)
    .upsert(patch, { onConflict: "user_id" })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as PreferencesDbRow)
}

/** @deprecated Use fetchGrowthPlatformAdminCommunicationPreferences */
export const fetchGrowthUserCommunicationPreferences = fetchGrowthPlatformAdminCommunicationPreferences

/** @deprecated Use upsertGrowthPlatformAdminCommunicationPreferences */
export const upsertGrowthUserCommunicationPreferences = upsertGrowthPlatformAdminCommunicationPreferences
