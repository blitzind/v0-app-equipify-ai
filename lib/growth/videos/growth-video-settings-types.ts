/** Growth Engine — Video workspace settings types (client-safe). */

import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"
import {
  GROWTH_VIDEO_ALLOWED_MIME_TYPES,
  GROWTH_VIDEO_MAX_UPLOAD_BYTES,
  GROWTH_VIDEO_SOURCE_TYPES,
  GROWTH_VIDEOS_STORAGE_BUCKET,
} from "@/lib/growth/videos/growth-video-types"
import { GROWTH_MEDIA_ASSETS_BUCKET } from "@/lib/growth/media/media-asset-types"
import { GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES } from "@/lib/growth/media/media-video-thumbnail-types"

export const GROWTH_VIDEO_SETTINGS_QA_MARKER = "growth-video-settings-v2" as const

export const GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME = "__growth_video_workspace_settings__" as const

export const GROWTH_VIDEO_SETTINGS_METADATA_KEY = "growth_video_settings" as const

export const GROWTH_VIDEO_SETTINGS_SECTIONS = ["storage", "branding", "permissions", "recording"] as const

export type GrowthVideoSettingsSection = (typeof GROWTH_VIDEO_SETTINGS_SECTIONS)[number]

export const GROWTH_VIDEO_RECORDING_QUALITIES = ["hd", "full_hd"] as const

export type GrowthVideoRecordingQuality = (typeof GROWTH_VIDEO_RECORDING_QUALITIES)[number]

export type GrowthVideoSettingsBranding = {
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  buttonColor: string | null
  buttonTextColor: string | null
  defaultCtaLabel: string | null
  defaultCalendarUrl: string | null
  footerText: string | null
}

export type GrowthVideoSettingsRecordingDefaults = {
  recordingMode: (typeof GROWTH_VIDEO_SOURCE_TYPES)[number]
  quality: GrowthVideoRecordingQuality
  maxDurationSeconds: number
  transcriptEnabled: boolean
  captionsEnabled: boolean
}

export type GrowthVideoSettingsStorageView = {
  videoBucket: string
  mediaBucket: string
  allowedVideoMimeTypes: string[]
  allowedImageMimeTypes: string[]
  maxUploadBytes: number
  maxUploadLabel: string
  providerStatus: string
  readOnly: true
}

export type GrowthVideoSettingsPermissionsView = {
  platformAdminRequired: true
  humanReviewRequired: true
  autonomousExecutionEnabled: false
  customerTenantAccessEnabled: false
  providerExecutionGated: true
  voiceProviderEnabled: boolean
  avatarProviderEnabled: boolean
  readOnly: true
}

export type GrowthVideoSettingsRecord = {
  branding: GrowthVideoSettingsBranding
  recordingDefaults: GrowthVideoSettingsRecordingDefaults
  storage: GrowthVideoSettingsStorageView
  permissions: GrowthVideoSettingsPermissionsView
  persisted: boolean
  updatedAt: string | null
}

export const DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING: GrowthVideoSettingsBranding = {
  logoUrl: null,
  primaryColor: DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor,
  accentColor: DEFAULT_GROWTH_SHARE_PAGE_THEME.accentColor,
  buttonColor: DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor,
  buttonTextColor: "#ffffff",
  defaultCtaLabel: "Book a meeting",
  defaultCalendarUrl: null,
  footerText: null,
}

export const DEFAULT_GROWTH_VIDEO_SETTINGS_RECORDING: GrowthVideoSettingsRecordingDefaults = {
  recordingMode: "webcam",
  quality: "hd",
  maxDurationSeconds: 600,
  transcriptEnabled: true,
  captionsEnabled: true,
}

export const GROWTH_VIDEO_SETTINGS_STATIC_STORAGE: GrowthVideoSettingsStorageView = {
  videoBucket: GROWTH_VIDEOS_STORAGE_BUCKET,
  mediaBucket: GROWTH_MEDIA_ASSETS_BUCKET,
  allowedVideoMimeTypes: [...GROWTH_VIDEO_ALLOWED_MIME_TYPES],
  allowedImageMimeTypes: [...GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES],
  maxUploadBytes: GROWTH_VIDEO_MAX_UPLOAD_BYTES,
  maxUploadLabel: "250 MB",
  providerStatus: "Supabase Storage (read-only view)",
  readOnly: true,
}
