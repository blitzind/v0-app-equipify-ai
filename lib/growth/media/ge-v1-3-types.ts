/** GE-v1-3 — ElevenLabs live personalized video generation (client-safe). */

export const GE_V1_3_ELEVENLABS_LIVE_QA_MARKER = "ge-v1-3-elevenlabs-live-v1" as const

export const GE_V1_3_ELEVENLABS_LIVE_CONFIRM = "RUN_GE_V1_3_ELEVENLABS_LIVE_CERTIFICATION" as const

export const GE_V1_3_GENERATION_LIFECYCLE_EVENT_TYPES = [
  "video_generated",
  "video_attached",
  "video_generation_failed",
  "video_generation_cancelled",
] as const

export type GeV13GenerationLifecycleEventType = (typeof GE_V1_3_GENERATION_LIFECYCLE_EVENT_TYPES)[number]

export type GeV13ProspectGenerationInput = {
  leadId?: string | null
  companyCandidateId?: string | null
  personCandidateId?: string | null
  personalizationProfileId?: string | null
  senderProfileId?: string | null
  operatorInstructions?: string | null
}

export type GeV13ResolvedProspectScript = {
  rawScript: string
  mergedScript: string
  scriptVersionId: string | null
  videoAssetId: string | null
  mergeValues: Record<string, string>
  missingVariables: string[]
  sourcesUsed: string[]
  degraded: boolean
}
