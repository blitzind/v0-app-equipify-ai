/** GE-AIOS-BUSINESS-PROFILE-1C / GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — Project approved Business Profile → lead discovery defaults (client-safe). */

import type {
  AvaDatamoonCompanySize,
  AvaDatamoonIntentLevel,
  AvaDatamoonLookbackDays,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER,
  projectApprovedBusinessProfileToSupportedServiceVerticals,
  type SupportedServiceVerticalProjectionEntry,
} from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import type { OperationalCapability } from "@/lib/growth/business-profile/supported-service-verticals"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"

export const GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER = "ge-aios-business-profile-1c-v1" as const

export type BusinessProfileLeadDiscoveryProjection = {
  topics: string[]
  industries: string[]
  jobTitles: string[]
  geography: {
    country: string
    state: string | null
    city: string | null
  }
  companySize: AvaDatamoonCompanySize
  keywords: string[]
  negativeKeywords: string[]
  buyerPersonas: string[]
  intentLevels: AvaDatamoonIntentLevel[]
  lookbackDays: AvaDatamoonLookbackDays
  assumptions: string[]
  audienceNameSuggestion: string
  /** GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B */
  supportedServiceVerticalsProjectionQaMarker: typeof GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER
  supportedServiceVerticals: SupportedServiceVerticalProjectionEntry[]
  qualificationCriteria: string[]
  operationalCapabilities: OperationalCapability[]
  industryAliases: string[]
  operationalEvidenceRequirements: string[]
}

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
}

function normalizeJobTitle(title: string): string {
  return title.trim().toLowerCase()
}

export function projectApprovedBusinessProfileToLeadDiscovery(
  profile: BusinessProfileDraftContent,
  companyName?: string | null,
): BusinessProfileLeadDiscoveryProjection {
  const verticalsProjection = projectApprovedBusinessProfileToSupportedServiceVerticals(profile, companyName)
  const jobTitles = verticalsProjection.discoveryIntent.buyerRoles.map(normalizeJobTitle).filter(Boolean)

  return {
    topics: verticalsProjection.discoveryIntent.topicSeedPhrases,
    industries: profile.idealCustomers.targetIndustries,
    jobTitles: jobTitles.length > 0 ? jobTitles : ["owner", "operations manager"],
    geography: {
      country: verticalsProjection.discoveryIntent.geography.country,
      state: verticalsProjection.discoveryIntent.geography.state,
      city: verticalsProjection.discoveryIntent.geography.city,
    },
    companySize: verticalsProjection.discoveryIntent.companySizeIntent,
    keywords: verticalsProjection.discoveryIntent.operationalKeywords,
    negativeKeywords: verticalsProjection.discoveryIntent.negativeKeywords,
    buyerPersonas: profile.idealCustomers.buyerPersonas,
    intentLevels: verticalsProjection.discoveryIntent.intentLevels,
    lookbackDays: verticalsProjection.discoveryIntent.lookbackDays,
    assumptions: verticalsProjection.assumptions,
    audienceNameSuggestion: verticalsProjection.audienceNameSuggestion,
    supportedServiceVerticalsProjectionQaMarker: verticalsProjection.qaMarker,
    supportedServiceVerticals: verticalsProjection.supportedServiceVerticals,
    qualificationCriteria: verticalsProjection.operationalModel.qualificationCriteria,
    operationalCapabilities: verticalsProjection.operationalModel.capabilities,
    industryAliases: verticalsProjection.discoveryIntent.industryAliases,
    operationalEvidenceRequirements: verticalsProjection.operationalModel.operationalEvidenceRequirements,
  }
}

export function parseUsStateFromCommand(text: string): string | null {
  for (const [name, code] of Object.entries(US_STATE_NAME_TO_CODE)) {
    if (text.includes(name)) return code
  }
  const codeMatch = text.match(/\bin ([a-z]{2})\b/)
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase()
    if (Object.values(US_STATE_NAME_TO_CODE).includes(code)) return code
  }
  return null
}

export function extractCommandTopicPhrase(text: string): string | null {
  const patterns = [
    /find\s+(.+?)\s+(companies|buyers|prospects|businesses)/i,
    /search\s+(?:for\s+)?(.+?)\s+(companies|buyers|prospects|businesses)/i,
    /look\s+for\s+(.+?)\s+(companies|buyers|prospects|businesses)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const phrase = match[1]
        .replace(/\b(u\.s\.-based|us-based|united states|in [a-z\s]+)\b/gi, "")
        .replace(/\b(showing|with|that|who)\b.*/gi, "")
        .trim()
      if (phrase.length >= 3) return phrase
    }
  }
  return null
}
