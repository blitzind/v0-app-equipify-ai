/** Voice Production Readiness Center — shared types (client-safe). */

export const VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER = "voice-production-readiness-center-v1" as const

export const VOICE_PRODUCTION_READINESS_SECTION_IDS = [
  "twilio_connection",
  "twilio_webhooks",
  "phone_numbers",
  "browser_calling",
  "media_streaming",
  "transcript_provider",
  "ai_provider",
  "receptionist",
  "voice_drops",
  "compliance",
  "workflow_orchestration",
  "multi_channel",
] as const

export type VoiceProductionReadinessSectionId = (typeof VOICE_PRODUCTION_READINESS_SECTION_IDS)[number]

export type VoiceProductionReadinessStatus = "ready" | "partial" | "blocked"

export type VoiceProductionReadinessWebhookUrl = {
  label: string
  url: string
}

export type VoiceProductionReadinessSection = {
  id: VoiceProductionReadinessSectionId
  title: string
  status: VoiceProductionReadinessStatus
  statusLabel: "Ready" | "Partial" | "Blocked"
  summary: string
  missingEnvVars: string[]
  missingCredentials: string[]
  missingWebhookUrls: string[]
  phoneNumberIssues: string[]
  failingHealthChecks: string[]
  lastSuccessfulTest: string | null
  recommendedFix: string
  webhookUrls: VoiceProductionReadinessWebhookUrl[]
  settingsHref: string | null
  deploymentRequirementsHref: string
}

export type VoiceProductionReadinessCenterSnapshot = {
  qaMarker: typeof VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER
  generatedAt: string
  organizationId: string | null
  schemaReady: boolean
  schemaMessage: string
  overallStatus: VoiceProductionReadinessStatus
  summary: {
    readyCount: number
    partialCount: number
    blockedCount: number
    totalSections: number
  }
  sections: VoiceProductionReadinessSection[]
  deploymentRequirementsHref: string
  globalSettingsHref: string
  transcriptProvidersHref: string
}

export const VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF = "/admin/growth/settings/communications" as const
export const VOICE_PRODUCTION_READINESS_TRANSCRIPT_PROVIDERS_HREF = "/admin/growth/calls/providers" as const
export const VOICE_PRODUCTION_READINESS_DEPLOYMENT_DOC = "docs/VOICE_ENVIRONMENT_REQUIREMENTS.md" as const
