import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import type {
  GrowthLiveCoachingSettings,
  RealtimeProviderIndustryProfile,
  RealtimeProviderId,
} from "@/lib/growth/realtime/providers/provider-types"

type SettingsRowExtras = {
  live_coaching_active_provider_connection_id?: string | null
  live_coaching_fallback_provider?: string
  live_coaching_speaker_separation_enabled?: boolean
  live_coaching_keyword_events_enabled?: boolean
  live_coaching_transcript_confidence_threshold?: number
  live_coaching_custom_keywords?: unknown
  live_coaching_industry_profile?: unknown
  live_coaching_critical_guidance_threshold?: number
  live_coaching_normal_guidance_threshold?: number
}

function copilotSettingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("copilot_settings")
}

function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

function parseIndustryProfile(value: unknown): RealtimeProviderIndustryProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  return {
    vertical: typeof raw.vertical === "string" ? raw.vertical : null,
    segment: typeof raw.segment === "string" ? raw.segment : null,
    version: typeof raw.version === "number" ? raw.version : undefined,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
  }
}

export async function fetchGrowthLiveCoachingSettings(
  admin: SupabaseClient,
): Promise<GrowthLiveCoachingSettings> {
  await fetchGrowthCopilotSettings(admin)
  const { data, error } = await copilotSettingsTable(admin)
    .select(
      "live_coaching_active_provider_connection_id, live_coaching_fallback_provider, live_coaching_speaker_separation_enabled, live_coaching_keyword_events_enabled, live_coaching_transcript_confidence_threshold, live_coaching_custom_keywords, live_coaching_industry_profile, live_coaching_critical_guidance_threshold, live_coaching_normal_guidance_threshold",
    )
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = (data ?? {}) as SettingsRowExtras
  return {
    activeProviderConnectionId: row.live_coaching_active_provider_connection_id ?? null,
    fallbackProvider: (row.live_coaching_fallback_provider ?? "stub") as RealtimeProviderId,
    speakerSeparationEnabled: row.live_coaching_speaker_separation_enabled ?? false,
    keywordEventsEnabled: row.live_coaching_keyword_events_enabled ?? false,
    transcriptConfidenceThreshold: row.live_coaching_transcript_confidence_threshold ?? 70,
    customKeywords: parseKeywords(row.live_coaching_custom_keywords),
    industryProfile: parseIndustryProfile(row.live_coaching_industry_profile),
    criticalGuidanceThreshold: row.live_coaching_critical_guidance_threshold ?? 85,
    normalGuidanceThreshold: row.live_coaching_normal_guidance_threshold ?? 70,
  }
}

export async function updateGrowthLiveCoachingSettings(
  admin: SupabaseClient,
  input: Partial<GrowthLiveCoachingSettings> & { updatedBy: string },
): Promise<GrowthLiveCoachingSettings> {
  await fetchGrowthCopilotSettings(admin)
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  }
  if (input.activeProviderConnectionId !== undefined) {
    patch.live_coaching_active_provider_connection_id = input.activeProviderConnectionId
  }
  if (input.fallbackProvider !== undefined) patch.live_coaching_fallback_provider = input.fallbackProvider
  if (input.speakerSeparationEnabled !== undefined) {
    patch.live_coaching_speaker_separation_enabled = input.speakerSeparationEnabled
  }
  if (input.keywordEventsEnabled !== undefined) {
    patch.live_coaching_keyword_events_enabled = input.keywordEventsEnabled
  }
  if (input.transcriptConfidenceThreshold !== undefined) {
    patch.live_coaching_transcript_confidence_threshold = input.transcriptConfidenceThreshold
  }
  if (input.customKeywords !== undefined) patch.live_coaching_custom_keywords = input.customKeywords
  if (input.industryProfile !== undefined) patch.live_coaching_industry_profile = input.industryProfile
  if (input.criticalGuidanceThreshold !== undefined) {
    patch.live_coaching_critical_guidance_threshold = input.criticalGuidanceThreshold
  }
  if (input.normalGuidanceThreshold !== undefined) {
    patch.live_coaching_normal_guidance_threshold = input.normalGuidanceThreshold
  }

  const { error } = await copilotSettingsTable(admin).update(patch).eq("singleton", true)
  if (error) throw new Error(error.message)
  return fetchGrowthLiveCoachingSettings(admin)
}
