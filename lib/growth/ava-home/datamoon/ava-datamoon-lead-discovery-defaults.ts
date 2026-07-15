/**
 * GE-AIOS-7C — Ava-led lead discovery defaults (client-safe).
 *
 * Derives search drafts, preset options, and explainability from the customer's
 * approved Growth Profile and active mission — never Equipify-internal ICP defaults.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  projectApprovedBusinessProfileToLeadDiscovery,
  type BusinessProfileLeadDiscoveryProjection,
} from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  createMinimalAvaDatamoonAudienceDraft,
  type AvaDatamoonAudienceDraft,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { enrichLeadDiscoveryContextWithBusinessIntelligence } from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context"
import type {
  BusinessIntelligenceLeadDiscoveryContextSlice,
  BusinessIntelligenceLeadDiscoverySignals,
  LeadDiscoveryExplainabilityLine,
  LeadDiscoveryExplainabilitySource,
} from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"

export type {
  LeadDiscoveryExplainabilityLine,
  LeadDiscoveryExplainabilitySource,
  BusinessIntelligenceLeadDiscoverySignals,
  BusinessIntelligenceLeadDiscoveryContextSlice,
}

export const GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER = "ge-aios-find-leads-7c-v1" as const

/** Legacy Equipify demo presets — must not be used as customer org defaults. */
export const EQUIPIFY_INTERNAL_TOPIC_PRESETS = [
  "equipment maintenance software",
  "medical equipment service",
  "public safety equipment service",
  "field service management",
  "repair and maintenance operations",
] as const

export const GENERIC_JOB_TITLE_FALLBACKS = ["owner", "operations manager", "general manager"] as const

export type LeadDiscoveryProfileReadiness = {
  ready: boolean
  missingFields: string[]
}

export type AvaLedLeadDiscoveryContext = {
  qaMarker: typeof GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER
  draft: AvaDatamoonAudienceDraft
  narrative: string
  explainability: LeadDiscoveryExplainabilityLine[]
  assumptions: string[]
  topicPresets: string[]
  jobTitlePresets: string[]
  missionTitle: string | null
  profileReady: boolean
  missingProfileFields: string[]
  businessProfileUsed: boolean
  businessIntelligence?: BusinessIntelligenceLeadDiscoveryContextSlice
}

export function assessLeadDiscoveryProfileReadiness(
  profile: BusinessProfileDraftContent | null,
): LeadDiscoveryProfileReadiness {
  if (!profile) {
    return { ready: false, missingFields: ["Approved Growth Profile"] }
  }

  const missing: string[] = []
  if (profile.idealCustomers.targetIndustries.length === 0) {
    missing.push("Target industries")
  }
  if (profile.idealCustomers.buyerPersonas.length === 0) {
    missing.push("Buyer personas")
  }
  return { ready: missing.length === 0, missingFields: missing }
}

export function buildLeadDiscoveryPresetOptions(
  projection: BusinessProfileLeadDiscoveryProjection | null,
): { topicPresets: string[]; jobTitlePresets: string[] } {
  if (!projection) {
    return { topicPresets: [], jobTitlePresets: [...GENERIC_JOB_TITLE_FALLBACKS] }
  }

  const topicPresets = Array.from(
    new Set(
      [
        ...projection.supportedServiceVerticals.map((vertical) => vertical.label),
        ...projection.industryAliases,
        ...projection.topics,
      ]
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  )

  const jobTitlePresets = Array.from(
    new Set(
      [...projection.buyerPersonas, ...projection.jobTitles]
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8)

  return {
    topicPresets,
    jobTitlePresets:
      jobTitlePresets.length > 0 ? jobTitlePresets : [...GENERIC_JOB_TITLE_FALLBACKS],
  }
}

export function buildAudienceDraftFromLeadDiscoveryProjection(
  projection: BusinessProfileLeadDiscoveryProjection,
  overrides?: Partial<AvaDatamoonAudienceDraft>,
): AvaDatamoonAudienceDraft {
  return createMinimalAvaDatamoonAudienceDraft({
    audienceName: projection.audienceNameSuggestion,
    topics: projection.topics.length > 0 ? projection.topics : projection.industryAliases,
    jobTitles: projection.jobTitles,
    geography: projection.geography,
    companySize: projection.companySize,
    intentLevels: projection.intentLevels,
    lookbackDays: projection.lookbackDays,
    ...overrides,
  })
}

function formatGeographyLabel(geography: AvaDatamoonAudienceDraft["geography"]): string {
  const parts = [geography.country, geography.state, geography.city].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "your configured geography"
}

function formatCompanySizeLabel(size: AvaDatamoonAudienceDraft["companySize"]): string {
  return size === "smb" ? "small and mid-sized businesses" : size
}

export function buildAvaLedSearchNarrative(input: {
  draft: AvaDatamoonAudienceDraft
  missionTitle?: string | null
}): string {
  const industries =
    input.draft.topics.length > 0
      ? input.draft.topics.join(", ")
      : "companies that match your supported service verticals"
  const roles =
    input.draft.jobTitles.length > 0
      ? input.draft.jobTitles.join(", ")
      : "your configured buyer personas"
  const missionLine = input.missionTitle
    ? `\nMission goal: ${input.missionTitle}`
    : ""

  return (
    `I'll look for companies that match your Growth Profile:\n` +
    `• Supported service verticals: ${industries}\n` +
    `• Buyer roles: ${roles}\n` +
    `• Geography: ${formatGeographyLabel(input.draft.geography)}\n` +
    `• Company size: ${formatCompanySizeLabel(input.draft.companySize)}` +
    missionLine +
    `\n\nI'll start with a conservative search and bring back the best matches for review.`
  )
}

export function buildLeadDiscoveryExplainability(input: {
  projection: BusinessProfileLeadDiscoveryProjection | null
  missionTitle?: string | null
}): LeadDiscoveryExplainabilityLine[] {
  const lines: LeadDiscoveryExplainabilityLine[] = []

  if (input.projection) {
    if (input.projection.supportedServiceVerticals.length > 0 || input.projection.topics.length > 0) {
      lines.push({
        id: "industries",
        label: "Supported service verticals",
        detail: "These come from your Growth Profile supported service verticals, target industries, and operational keywords.",
        source: "approved_business_profile",
      })
    }
    if (input.projection.buyerPersonas.length > 0 || input.projection.jobTitles.length > 0) {
      lines.push({
        id: "buyer-roles",
        label: "Buyer roles",
        detail: "These job titles come from your Growth Profile buyer personas.",
        source: "approved_business_profile",
      })
    }
    if (input.projection.geography.country) {
      lines.push({
        id: "geography",
        label: "Geography",
        detail: "Geography comes from your Growth Profile ideal customer geography.",
        source: "approved_business_profile",
      })
    }
    if (input.projection.companySize) {
      lines.push({
        id: "company-size",
        label: "Company size",
        detail: "Company size comes from your Growth Profile company size ranges.",
        source: "approved_business_profile",
      })
    }
  }

  if (input.missionTitle) {
    lines.push({
      id: "mission",
      label: "Active mission",
      detail: `This search is tied to your active mission: ${input.missionTitle}.`,
      source: "mission",
    })
  }

  if (lines.length === 0) {
    lines.push({
      id: "fallback",
      label: "Conservative defaults",
      detail: "Using generic search defaults until your Growth Profile is complete.",
      source: "fallback",
    })
  }

  return lines
}

export function buildAvaLedLeadDiscoveryContext(input: {
  profile: BusinessProfileDraftContent | null
  companyName?: string | null
  missionTitle?: string | null
  businessIntelligenceSignals?: BusinessIntelligenceLeadDiscoverySignals | null
}): AvaLedLeadDiscoveryContext {
  const readiness = assessLeadDiscoveryProfileReadiness(input.profile)
  const projection = input.profile
    ? projectApprovedBusinessProfileToLeadDiscovery(input.profile, input.companyName)
    : null

  const draft = projection
    ? buildAudienceDraftFromLeadDiscoveryProjection(projection)
    : createMinimalAvaDatamoonAudienceDraft()

  const { topicPresets, jobTitlePresets } = buildLeadDiscoveryPresetOptions(projection)
  const explainability = buildLeadDiscoveryExplainability({
    projection,
    missionTitle: input.missionTitle,
  })

  const assumptions = [
    ...(projection?.assumptions ?? []),
    input.missionTitle ? `Aligned to active mission: ${input.missionTitle}.` : null,
    "Conservative record limit and intent filters for first-pass review.",
  ].filter((line): line is string => Boolean(line))

  const base: AvaLedLeadDiscoveryContext = {
    qaMarker: GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER,
    draft,
    narrative: buildAvaLedSearchNarrative({ draft, missionTitle: input.missionTitle }),
    explainability,
    assumptions,
    topicPresets,
    jobTitlePresets,
    missionTitle: input.missionTitle ?? null,
    profileReady: readiness.ready,
    missingProfileFields: readiness.missingFields,
    businessProfileUsed: projection != null,
  }

  return enrichLeadDiscoveryContextWithBusinessIntelligence(base, input.businessIntelligenceSignals)
}

export function draftUsesEquipifyInternalDefaults(draft: AvaDatamoonAudienceDraft): boolean {
  return draft.topics.some((topic) =>
    EQUIPIFY_INTERNAL_TOPIC_PRESETS.includes(topic as (typeof EQUIPIFY_INTERNAL_TOPIC_PRESETS)[number]),
  )
}
