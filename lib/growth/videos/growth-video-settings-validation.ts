/** Growth Engine — Video workspace settings validation (client-safe). */

import { z } from "zod"
import {
  GROWTH_VIDEO_RECORDING_QUALITIES,
  type GrowthVideoSettingsBranding,
  type GrowthVideoSettingsRecordingDefaults,
} from "@/lib/growth/videos/growth-video-settings-types"
import { GROWTH_VIDEO_SOURCE_TYPES } from "@/lib/growth/videos/growth-video-types"

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color")
  .nullable()
  .optional()

const nullableUrl = z.string().trim().url().max(2048).nullable().optional()

export const growthVideoSettingsBrandingPatchSchema = z
  .object({
    logoUrl: nullableUrl,
    primaryColor: hexColor,
    accentColor: hexColor,
    buttonColor: hexColor,
    buttonTextColor: hexColor,
    defaultCtaLabel: z.string().trim().max(120).nullable().optional(),
    defaultCalendarUrl: nullableUrl,
    footerText: z.string().trim().max(500).nullable().optional(),
  })
  .strict()

export const growthVideoSettingsRecordingPatchSchema = z
  .object({
    recordingMode: z.enum(GROWTH_VIDEO_SOURCE_TYPES as unknown as [string, ...string[]]).optional(),
    quality: z.enum(GROWTH_VIDEO_RECORDING_QUALITIES).optional(),
    maxDurationSeconds: z.number().int().min(30).max(3600).optional(),
    transcriptEnabled: z.boolean().optional(),
    captionsEnabled: z.boolean().optional(),
  })
  .strict()

export const growthVideoSettingsPatchSchema = z
  .object({
    branding: growthVideoSettingsBrandingPatchSchema.optional(),
    recording_defaults: growthVideoSettingsRecordingPatchSchema.optional(),
  })
  .strict()

export function mergeGrowthVideoSettingsBranding(
  current: GrowthVideoSettingsBranding,
  patch: z.infer<typeof growthVideoSettingsBrandingPatchSchema>,
): GrowthVideoSettingsBranding {
  return {
    logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : current.logoUrl,
    primaryColor: patch.primaryColor !== undefined ? patch.primaryColor : current.primaryColor,
    accentColor: patch.accentColor !== undefined ? patch.accentColor : current.accentColor,
    buttonColor: patch.buttonColor !== undefined ? patch.buttonColor : current.buttonColor,
    buttonTextColor: patch.buttonTextColor !== undefined ? patch.buttonTextColor : current.buttonTextColor,
    defaultCtaLabel: patch.defaultCtaLabel !== undefined ? patch.defaultCtaLabel : current.defaultCtaLabel,
    defaultCalendarUrl:
      patch.defaultCalendarUrl !== undefined ? patch.defaultCalendarUrl : current.defaultCalendarUrl,
    footerText: patch.footerText !== undefined ? patch.footerText : current.footerText,
  }
}

export function mergeGrowthVideoSettingsRecording(
  current: GrowthVideoSettingsRecordingDefaults,
  patch: z.infer<typeof growthVideoSettingsRecordingPatchSchema>,
): GrowthVideoSettingsRecordingDefaults {
  return {
    recordingMode: (patch.recordingMode ?? current.recordingMode) as GrowthVideoSettingsRecordingDefaults["recordingMode"],
    quality: (patch.quality ?? current.quality) as GrowthVideoSettingsRecordingDefaults["quality"],
    maxDurationSeconds: patch.maxDurationSeconds ?? current.maxDurationSeconds,
    transcriptEnabled: patch.transcriptEnabled ?? current.transcriptEnabled,
    captionsEnabled: patch.captionsEnabled ?? current.captionsEnabled,
  }
}
