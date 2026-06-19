import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthAvatarProviderStates } from "@/lib/growth/media/growth-ai-avatar-provider-config"
import { getGrowthElevenLabsVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-provider-config"
import { GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES } from "@/lib/growth/media/media-video-thumbnail-types"
import {
  DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING,
  DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING,
  GROWTH_VIDEO_SETTINGS_METADATA_KEY,
  GROWTH_VIDEO_SETTINGS_STATIC_STORAGE,
  GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME,
  type GrowthVideoSettingsBranding,
  type GrowthVideoSettingsPermissionsView,
  type GrowthVideoSettingsRecord,
  type GrowthVideoSettingsRecordingDefaults,
  type GrowthVideoSettingsStorageView,
} from "@/lib/growth/videos/growth-video-settings-types"
import {
  mergeGrowthVideoSettingsBranding,
  mergeGrowthVideoSettingsRecording,
  type growthVideoSettingsBrandingPatchSchema,
  type growthVideoSettingsRecordingPatchSchema,
} from "@/lib/growth/videos/growth-video-settings-validation"
import {
  GROWTH_VIDEO_ALLOWED_MIME_TYPES,
  GROWTH_VIDEO_MAX_UPLOAD_BYTES,
  GROWTH_VIDEOS_STORAGE_BUCKET,
} from "@/lib/growth/videos/growth-video-types"
import { GROWTH_MEDIA_ASSETS_BUCKET } from "@/lib/growth/media/media-asset-types"
import type { z } from "zod"

type SettingsTemplateRow = {
  id: string
  organization_id: string
  configuration_json: Record<string, unknown> | null
  updated_at: string
}

type PersistedSettingsPayload = {
  branding?: Partial<GrowthVideoSettingsBranding>
  recording_defaults?: Partial<GrowthVideoSettingsRecordingDefaults>
}

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("video_templates")
}

function parseBranding(raw: unknown): GrowthVideoSettingsBranding {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.logoUrl,
    primaryColor:
      typeof value.primaryColor === "string" ? value.primaryColor : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.primaryColor,
    accentColor:
      typeof value.accentColor === "string" ? value.accentColor : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.accentColor,
    buttonColor:
      typeof value.buttonColor === "string" ? value.buttonColor : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.buttonColor,
    buttonTextColor:
      typeof value.buttonTextColor === "string"
        ? value.buttonTextColor
        : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.buttonTextColor,
    defaultCtaLabel:
      typeof value.defaultCtaLabel === "string"
        ? value.defaultCtaLabel
        : DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING.defaultCtaLabel,
    defaultCalendarUrl:
      typeof value.defaultCalendarUrl === "string" ? value.defaultCalendarUrl : null,
    footerText: typeof value.footerText === "string" ? value.footerText : null,
  }
}

function parseRecordingDefaults(raw: unknown): GrowthVideoSettingsRecordingDefaults {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    recordingMode:
      typeof value.recordingMode === "string"
        ? (value.recordingMode as GrowthVideoSettingsRecordingDefaults["recordingMode"])
        : DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING.recordingMode,
    quality:
      value.quality === "full_hd" || value.quality === "hd"
        ? value.quality
        : DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING.quality,
    maxDurationSeconds:
      typeof value.maxDurationSeconds === "number"
        ? value.maxDurationSeconds
        : DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING.maxDurationSeconds,
    transcriptEnabled:
      typeof value.transcriptEnabled === "boolean"
        ? value.transcriptEnabled
        : DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING.transcriptEnabled,
    captionsEnabled:
      typeof value.captionsEnabled === "boolean"
        ? value.captionsEnabled
        : DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING.captionsEnabled,
  }
}

function parsePersistedPayload(configuration: Record<string, unknown> | null): PersistedSettingsPayload {
  const root = configuration?.[GROWTH_VIDEO_SETTINGS_METADATA_KEY]
  if (!root || typeof root !== "object") return {}
  const payload = root as Record<string, unknown>
  return {
    branding: payload.branding as PersistedSettingsPayload["branding"],
    recording_defaults: payload.recording_defaults as PersistedSettingsPayload["recording_defaults"],
  }
}

async function getSettingsTemplateRow(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SettingsTemplateRow | null> {
  const { data, error } = await templatesTable(admin)
    .select("id, organization_id, configuration_json, updated_at")
    .eq("organization_id", organizationId)
    .eq("name", GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as SettingsTemplateRow | null) ?? null
}

async function ensureSettingsTemplateRow(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SettingsTemplateRow> {
  const existing = await getSettingsTemplateRow(admin, organizationId)
  if (existing) return existing

  const { data, error } = await templatesTable(admin)
    .insert({
      organization_id: organizationId,
      name: GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME,
      description: "Internal Growth Video workspace settings (not a user-facing template).",
      configuration_json: {
        [GROWTH_VIDEO_SETTINGS_METADATA_KEY]: {
          branding: DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING,
          recording_defaults: DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING,
        },
      },
    })
    .select("id, organization_id, configuration_json, updated_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "settings_insert_failed")
  return data as SettingsTemplateRow
}

function buildPermissionsView(): GrowthVideoSettingsPermissionsView {
  const voice = getGrowthElevenLabsVoiceProviderState()
  const avatarProviders = getGrowthAvatarProviderStates()
  const avatarProviderEnabled = Object.values(avatarProviders).some((state) => state.enabled)
  return {
    platformAdminRequired: true,
    humanReviewRequired: true,
    autonomousExecutionEnabled: false,
    customerTenantAccessEnabled: false,
    providerExecutionGated: true,
    voiceProviderEnabled: voice.enabled,
    avatarProviderEnabled,
    readOnly: true,
  }
}

async function resolveStorageView(admin: SupabaseClient): Promise<GrowthVideoSettingsStorageView> {
  const [videoBucket, mediaBucket] = await Promise.all([
    admin.storage.getBucket(GROWTH_VIDEOS_STORAGE_BUCKET),
    admin.storage.getBucket(GROWTH_MEDIA_ASSETS_BUCKET),
  ])

  const videoMimeTypes =
    videoBucket.data?.allowed_mime_types?.filter(Boolean) ??
    [...GROWTH_VIDEO_ALLOWED_MIME_TYPES, ...GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES]
  const maxUploadBytes = videoBucket.data?.file_size_limit ?? GROWTH_VIDEO_MAX_UPLOAD_BYTES

  return {
    ...GROWTH_VIDEO_SETTINGS_STATIC_STORAGE,
    allowedVideoMimeTypes: videoMimeTypes.filter((mime) => mime.startsWith("video/")),
    allowedImageMimeTypes: videoMimeTypes.filter((mime) => mime.startsWith("image/")),
    maxUploadBytes,
    maxUploadLabel: `${Math.round(maxUploadBytes / (1024 * 1024))} MB`,
    providerStatus: mediaBucket.error
      ? "Supabase Storage (video bucket verified; media bucket unavailable)"
      : "Supabase Storage (read-only view)",
    readOnly: true,
  }
}

export async function loadGrowthVideoSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthVideoSettingsRecord> {
  const row = await getSettingsTemplateRow(admin, organizationId)
  const payload = parsePersistedPayload(row?.configuration_json ?? null)

  return {
    branding: parseBranding(payload.branding),
    recordingDefaults: parseRecordingDefaults(payload.recording_defaults),
    storage: await resolveStorageView(admin),
    permissions: buildPermissionsView(),
    persisted: Boolean(row),
    updatedAt: row?.updated_at ?? null,
  }
}

export async function patchGrowthVideoSettings(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    branding?: z.infer<typeof growthVideoSettingsBrandingPatchSchema>
    recording_defaults?: z.infer<typeof growthVideoSettingsRecordingPatchSchema>
  },
): Promise<GrowthVideoSettingsRecord> {
  const row = await ensureSettingsTemplateRow(admin, organizationId)
  const payload = parsePersistedPayload(row.configuration_json)
  const currentBranding = parseBranding(payload.branding)
  const currentRecording = parseRecordingDefaults(payload.recording_defaults)

  const nextPayload = {
    branding: input.branding ? mergeGrowthVideoSettingsBranding(currentBranding, input.branding) : currentBranding,
    recording_defaults: input.recording_defaults
      ? mergeGrowthVideoSettingsRecording(currentRecording, input.recording_defaults)
      : currentRecording,
  }

  const configuration = {
    ...(row.configuration_json ?? {}),
    [GROWTH_VIDEO_SETTINGS_METADATA_KEY]: nextPayload,
  }

  const { data, error } = await templatesTable(admin)
    .update({ configuration_json: configuration })
    .eq("id", row.id)
    .select("id, organization_id, configuration_json, updated_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "settings_update_failed")

  return loadGrowthVideoSettings(admin, organizationId)
}

export function isGrowthVideoWorkspaceSettingsTemplateName(name: string): boolean {
  return name === GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME
}
