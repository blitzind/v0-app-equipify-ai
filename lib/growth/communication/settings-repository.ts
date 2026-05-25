import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCommunicationDefaults } from "@/lib/growth/communication/scope"
import type { GrowthCallDialMode, GrowthPlatformCommunicationSettings } from "@/lib/growth/communication/types"
import type { GrowthMeetingLocationProvider } from "@/lib/growth/meeting-location/meeting-location-provider-types"

type SettingsDbRow = {
  id: string
  active_email_connection_id: string | null
  call_dial_mode: string
  custom_url_template: string | null
  show_alternate_dialers: boolean
  default_meeting_provider: string
  auto_create_meeting_link: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, active_email_connection_id, call_dial_mode, custom_url_template, show_alternate_dialers, default_meeting_provider, auto_create_meeting_link, updated_by, created_at, updated_at"

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("communication_settings")
}

function mapRow(row: SettingsDbRow): GrowthPlatformCommunicationSettings {
  return {
    id: row.id,
    activeEmailConnectionId: row.active_email_connection_id,
    callDialMode: row.call_dial_mode as GrowthCallDialMode,
    customUrlTemplate: row.custom_url_template,
    showAlternateDialers: row.show_alternate_dialers,
    defaultMeetingProvider: row.default_meeting_provider as GrowthPlatformCommunicationSettings["defaultMeetingProvider"],
    autoCreateMeetingLink: row.auto_create_meeting_link,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toGrowthCommunicationDefaults(
  settings: GrowthPlatformCommunicationSettings,
): GrowthCommunicationDefaults {
  return {
    callDialMode: settings.callDialMode,
    customUrlTemplate: settings.customUrlTemplate,
    showAlternateDialers: settings.showAlternateDialers,
    activeEmailConnectionId: settings.activeEmailConnectionId,
  }
}

/** Platform-scope singleton row (`growth.communication_settings`). Future org defaults use the same shape. */
export async function fetchGrowthPlatformCommunicationSettings(
  admin: SupabaseClient,
): Promise<GrowthPlatformCommunicationSettings> {
  const { data, error } = await settingsTable(admin).select(SELECT).limit(1).maybeSingle()
  if (error) throw new Error(error.message)

  if (data) {
    return mapRow(data as SettingsDbRow)
  }

  const { data: inserted, error: insertError } = await settingsTable(admin)
    .insert({ singleton: true })
    .select(SELECT)
    .single()

  if (insertError) throw new Error(insertError.message)
  return mapRow(inserted as SettingsDbRow)
}

export async function updateGrowthPlatformCommunicationSettings(
  admin: SupabaseClient,
  input: {
    activeEmailConnectionId?: string | null
    callDialMode?: GrowthCallDialMode
    customUrlTemplate?: string | null
    showAlternateDialers?: boolean
    defaultMeetingProvider?: GrowthMeetingLocationProvider
    autoCreateMeetingLink?: boolean
    updatedBy: string
  },
): Promise<GrowthPlatformCommunicationSettings> {
  const existing = await fetchGrowthPlatformCommunicationSettings(admin)
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  }

  if (input.activeEmailConnectionId !== undefined) {
    patch.active_email_connection_id = input.activeEmailConnectionId
  }
  if (input.callDialMode !== undefined) {
    patch.call_dial_mode = input.callDialMode
  }
  if (input.customUrlTemplate !== undefined) {
    patch.custom_url_template = input.customUrlTemplate?.trim() ? input.customUrlTemplate.trim() : null
  }
  if (input.showAlternateDialers !== undefined) {
    patch.show_alternate_dialers = input.showAlternateDialers
  }
  if (input.defaultMeetingProvider !== undefined) {
    patch.default_meeting_provider = input.defaultMeetingProvider
  }
  if (input.autoCreateMeetingLink !== undefined) {
    patch.auto_create_meeting_link = input.autoCreateMeetingLink
  }

  const { data, error } = await settingsTable(admin).update(patch).eq("id", existing.id).select(SELECT).single()
  if (error) throw new Error(error.message)
  return mapRow(data as SettingsDbRow)
}

/** @deprecated Use fetchGrowthPlatformCommunicationSettings */
export const fetchGrowthCommunicationSettings = fetchGrowthPlatformCommunicationSettings

/** @deprecated Use updateGrowthPlatformCommunicationSettings */
export const updateGrowthCommunicationSettings = updateGrowthPlatformCommunicationSettings

export async function isGrowthEmailConnectionActiveInPlatformSettings(
  admin: SupabaseClient,
  connectionId: string,
): Promise<boolean> {
  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  return settings.activeEmailConnectionId === connectionId
}
