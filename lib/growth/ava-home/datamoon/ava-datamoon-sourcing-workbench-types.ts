/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Workbench audience draft schema (client-safe). */

export const GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER =
  "ge-ava-datamoon-sourcing-workbench-1a-v1" as const

export const AVA_DATAMOON_AUDIENCE_TYPES = ["advanced_search", "b2b"] as const
export type AvaDatamoonAudienceType = (typeof AVA_DATAMOON_AUDIENCE_TYPES)[number]

export const AVA_DATAMOON_PROVIDER_MODES = ["module", "ext"] as const
export type AvaDatamoonProviderMode = (typeof AVA_DATAMOON_PROVIDER_MODES)[number]

export const AVA_DATAMOON_LOOKBACK_DAYS = [7, 14, 30, 60, 90] as const
export type AvaDatamoonLookbackDays = (typeof AVA_DATAMOON_LOOKBACK_DAYS)[number]

export const AVA_DATAMOON_INTENT_LEVELS = ["high", "medium", "low"] as const
export type AvaDatamoonIntentLevel = (typeof AVA_DATAMOON_INTENT_LEVELS)[number]

export const AVA_DATAMOON_TOPIC_PRESETS = [
  "equipment maintenance software",
  "medical equipment service",
  "public safety equipment service",
  "field service management",
  "repair and maintenance operations",
] as const

export const AVA_DATAMOON_JOB_TITLE_PRESETS = [
  "owner",
  "founder",
  "CEO",
  "president",
  "operations manager",
  "service manager",
  "general manager",
] as const

export const AVA_DATAMOON_COMPANY_SIZES = [
  "smb",
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
] as const
export type AvaDatamoonCompanySize = (typeof AVA_DATAMOON_COMPANY_SIZES)[number]

export type AvaDatamoonAudienceDraft = {
  audienceName: string
  audienceType: AvaDatamoonAudienceType
  providerMode: AvaDatamoonProviderMode
  recordLimit: number
  lookbackDays: AvaDatamoonLookbackDays
  intentLevels: AvaDatamoonIntentLevel[]
  geography: {
    country: string
    state: string | null
    city: string | null
  }
  topics: string[]
  customTopic: string | null
  jobTitles: string[]
  customJobTitle: string | null
  companySize: AvaDatamoonCompanySize
  revenueRange: string | null
  includeBusinessEmail: boolean
  includePhone: boolean
  includeLinkedIn: boolean
  excludeDuplicates: boolean
  onlyNewSinceLastRefresh: boolean
}

export type AvaDatamoonSourcingDraftResult = {
  audienceDraft: AvaDatamoonAudienceDraft
  explanation: string
  confidence: number
  assumptions: string[]
  overrides: string[]
  businessProfileUsed: boolean
  businessProfileStatus: "approved" | "missing"
  editable: true
  requiresApproval: true
}

export type AvaDatamoonSourcingWorkbenchMode = "ava_draft" | "manual_search"

export function createMinimalAvaDatamoonAudienceDraft(
  overrides?: Partial<AvaDatamoonAudienceDraft>,
): AvaDatamoonAudienceDraft {
  return {
    audienceName: "Lead discovery search",
    audienceType: "advanced_search",
    providerMode: "module",
    recordLimit: 100,
    lookbackDays: 7,
    intentLevels: ["high", "medium"],
    geography: { country: "US", state: null, city: null },
    topics: [],
    customTopic: null,
    jobTitles: [],
    customJobTitle: null,
    companySize: "smb",
    revenueRange: null,
    includeBusinessEmail: true,
    includePhone: true,
    includeLinkedIn: true,
    excludeDuplicates: true,
    onlyNewSinceLastRefresh: true,
    ...overrides,
  }
}

export function createDefaultAvaDatamoonAudienceDraft(
  overrides?: Partial<AvaDatamoonAudienceDraft>,
): AvaDatamoonAudienceDraft {
  // GE-AIOS-7C — no Equipify-internal prefills; callers hydrate from Growth Profile.
  return createMinimalAvaDatamoonAudienceDraft(overrides)
}
