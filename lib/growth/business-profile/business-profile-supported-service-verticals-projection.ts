/** GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — Approved Business Profile → Supported Service Verticals projection (client-safe). */

import type {
  AvaDatamoonCompanySize,
  AvaDatamoonIntentLevel,
  AvaDatamoonLookbackDays,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  buildIndustryAliasesFromVerticals,
  buildProspectSearchPrimaryQueryLabel,
  buildTopicSeedPhrasesFromVerticals,
  extractOperationalCapabilitiesFromKeywords,
  extractOperationalCapabilitiesFromQualificationCriteria,
  mergeOperationalCapabilities,
  resolveSupportedServiceVerticalsFromProfile,
  type OperationalCapability,
  type ResolvedSupportedServiceVertical,
  type SupportedServiceVerticalId,
} from "@/lib/growth/business-profile/supported-service-verticals"

export const GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER =
  "ge-aios-supported-service-verticals-projection-1b-v1" as const

export type SupportedServiceVerticalProjectionEntry = ResolvedSupportedServiceVertical

export type SupportedServiceVerticalsOperationalModel = {
  customerFacingService: true
  capabilities: OperationalCapability[]
  qualificationCriteria: string[]
  operationalEvidenceRequirements: string[]
}

export type SupportedServiceVerticalsDiscoveryIntent = {
  topicSeedPhrases: string[]
  buyerRoles: string[]
  operationalKeywords: string[]
  negativeKeywords: string[]
  disqualifiers: string[]
  industryAliases: string[]
  geography: {
    country: string
    state: string | null
    city: string | null
    labels: string[]
  }
  companySizeRanges: string[]
  companySizeIntent: AvaDatamoonCompanySize
  naicsCodes: string[]
  excludedNaicsCodes: string[]
  sicCodes: string[]
  excludedSicCodes: string[]
  intentLevels: AvaDatamoonIntentLevel[]
  lookbackDays: AvaDatamoonLookbackDays
}

export type SupportedServiceVerticalsProspectSearchSlice = {
  supportedServiceVerticalIds: string[]
  industryAliases: string[]
  operationalKeywords: string[]
  qualificationCriteria: string[]
  operationalEvidenceRequirements: string[]
  primaryQueryLabel: string
}

export type BusinessProfileSupportedServiceVerticalsProjection = {
  qaMarker: typeof GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER
  supportedServiceVerticals: SupportedServiceVerticalProjectionEntry[]
  operationalModel: SupportedServiceVerticalsOperationalModel
  discoveryIntent: SupportedServiceVerticalsDiscoveryIntent
  prospectSearch: SupportedServiceVerticalsProspectSearchSlice
  assumptions: string[]
  audienceNameSuggestion: string
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

function mapCompanySizeRanges(ranges: string[]): AvaDatamoonCompanySize {
  for (const range of ranges) {
    const normalized = range.toLowerCase()
    if (/500\+|enterprise/.test(normalized)) return "500+"
    if (/201.?500/.test(normalized)) return "201-500"
    if (/51.?200/.test(normalized)) return "51-200"
    if (/11.?50/.test(normalized)) return "11-50"
    if (/1.?10/.test(normalized)) return "1-10"
    if (/smb|small|mid/.test(normalized)) return "smb"
  }
  return "smb"
}

function parseGeographyFromProfile(entries: string[]): SupportedServiceVerticalsDiscoveryIntent["geography"] {
  const labels = entries.map((entry) => entry.trim()).filter(Boolean)
  const first = labels[0] ?? "United States"
  const lower = first.toLowerCase()

  if (/united states|u\.s\.|usa|us\b/.test(lower)) {
    return { country: "US", state: null, city: null, labels: labels.length > 0 ? labels : ["United States"] }
  }

  for (const [name, code] of Object.entries(US_STATE_NAME_TO_CODE)) {
    if (lower.includes(name)) {
      return { country: "US", state: code, city: null, labels }
    }
  }

  if (/^[A-Z]{2}$/.test(first.trim())) {
    return { country: "US", state: first.trim().toUpperCase(), city: null, labels }
  }

  return { country: "US", state: null, city: null, labels: labels.length > 0 ? labels : ["United States"] }
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function buildOperationalEvidenceRequirements(input: {
  qualificationCriteria: readonly string[]
  capabilities: readonly OperationalCapability[]
}): string[] {
  return uniqueStrings([
    ...input.qualificationCriteria,
    ...input.capabilities.map((capability) => capability.replace(/_/g, " ")),
  ])
}

function buildDiscoveryTopicSeedPhrases(input: {
  verticals: readonly ResolvedSupportedServiceVertical[]
  operationalKeywords: readonly string[]
}): string[] {
  return uniqueStrings([
    ...buildTopicSeedPhrasesFromVerticals(input.verticals),
    ...input.operationalKeywords,
  ])
}

function buildNaicsHintsFromVerticals(
  verticals: readonly ResolvedSupportedServiceVertical[],
  preferredNaicsCodes: readonly string[],
): string[] {
  return uniqueStrings([
    ...preferredNaicsCodes,
    ...verticals.flatMap((vertical) => vertical.naicsHints),
  ])
}

export function projectApprovedBusinessProfileToSupportedServiceVerticals(
  profile: BusinessProfileDraftContent,
  companyName?: string | null,
): BusinessProfileSupportedServiceVerticalsProjection {
  const supportedServiceVerticals = resolveSupportedServiceVerticalsFromProfile({
    targetIndustries: profile.idealCustomers.targetIndustries,
    explicitVerticals: profile.idealCustomers.supportedServiceVerticals,
  })

  const qualificationCriteria = profile.salesAndMarketing.qualificationCriteria.map((entry) => entry.trim()).filter(Boolean)
  const operationalKeywords = profile.problemsAndTriggers.keywords.map((entry) => entry.trim()).filter(Boolean)
  const capabilities = mergeOperationalCapabilities(
    supportedServiceVerticals.flatMap((vertical) => vertical.operationalFocus),
    extractOperationalCapabilitiesFromQualificationCriteria(qualificationCriteria),
    extractOperationalCapabilitiesFromKeywords(operationalKeywords),
  )
  const operationalEvidenceRequirements = buildOperationalEvidenceRequirements({
    qualificationCriteria,
    capabilities,
  })
  const industryAliases = buildIndustryAliasesFromVerticals(supportedServiceVerticals)
  const topicSeedPhrases = buildDiscoveryTopicSeedPhrases({
    verticals: supportedServiceVerticals,
    operationalKeywords,
  })
  const geography = parseGeographyFromProfile(profile.idealCustomers.geography)
  const buyerRoles = uniqueStrings([
    ...profile.idealCustomers.buyerPersonas,
    ...profile.idealCustomers.buyerPersonas.map((persona) => persona.trim().toLowerCase()),
  ])

  const discoveryIntent: SupportedServiceVerticalsDiscoveryIntent = {
    topicSeedPhrases,
    buyerRoles,
    operationalKeywords,
    negativeKeywords: profile.problemsAndTriggers.negativeKeywords,
    disqualifiers: profile.idealCustomers.disqualifiers,
    industryAliases,
    geography,
    companySizeRanges: profile.idealCustomers.companySizeRanges,
    companySizeIntent: mapCompanySizeRanges(profile.idealCustomers.companySizeRanges),
    naicsCodes: buildNaicsHintsFromVerticals(
      supportedServiceVerticals,
      profile.idealCustomers.preferredNaicsCodes ?? [],
    ),
    excludedNaicsCodes: profile.idealCustomers.excludedNaicsCodes ?? [],
    sicCodes: profile.idealCustomers.preferredSicCodes ?? [],
    excludedSicCodes: profile.idealCustomers.excludedSicCodes ?? [],
    intentLevels: ["high", "medium"],
    lookbackDays: 7,
  }

  const prospectSearch: SupportedServiceVerticalsProspectSearchSlice = {
    supportedServiceVerticalIds: supportedServiceVerticals.map((vertical) => vertical.id),
    industryAliases,
    operationalKeywords,
    qualificationCriteria,
    operationalEvidenceRequirements,
    primaryQueryLabel: buildProspectSearchPrimaryQueryLabel(supportedServiceVerticals),
  }

  const verticalLabels = supportedServiceVerticals.map((vertical) => vertical.label)
  const assumptions = [
    "Started from your approved Business Profile.",
    `Supported service verticals: ${verticalLabels.join(", ") || "see profile"}.`,
    `Qualification criteria: ${qualificationCriteria.slice(0, 4).join("; ") || "see profile"}.`,
    `Buyer roles: ${profile.idealCustomers.buyerPersonas.slice(0, 4).join(", ") || "see profile"}.`,
  ]

  return {
    qaMarker: GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER,
    supportedServiceVerticals,
    operationalModel: {
      customerFacingService: true,
      capabilities,
      qualificationCriteria,
      operationalEvidenceRequirements,
    },
    discoveryIntent,
    prospectSearch,
    assumptions,
    audienceNameSuggestion: companyName
      ? `${companyName} supported service verticals audience`
      : `${verticalLabels[0] ?? "Lead discovery"} audience`,
  }
}

export function isRegistrySupportedServiceVerticalId(
  id: string,
): id is SupportedServiceVerticalId {
  return id.length > 0 && !id.startsWith("profile:")
}
