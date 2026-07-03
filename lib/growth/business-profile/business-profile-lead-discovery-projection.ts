/** GE-AIOS-BUSINESS-PROFILE-1C — Project approved Business Profile → lead discovery defaults (client-safe). */

import type {
  AvaDatamoonCompanySize,
  AvaDatamoonIntentLevel,
  AvaDatamoonLookbackDays,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
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

function parseGeographyFromProfile(entries: string[]): BusinessProfileLeadDiscoveryProjection["geography"] {
  const first = entries[0]?.trim() ?? "United States"
  const lower = first.toLowerCase()

  if (/united states|u\.s\.|usa|us\b/.test(lower)) {
    return { country: "US", state: null, city: null }
  }

  for (const [name, code] of Object.entries(US_STATE_NAME_TO_CODE)) {
    if (lower.includes(name)) {
      return { country: "US", state: code, city: null }
    }
  }

  if (/^[A-Z]{2}$/.test(first.trim())) {
    return { country: "US", state: first.trim().toUpperCase(), city: null }
  }

  return { country: "US", state: null, city: null }
}

function buildTopics(profile: BusinessProfileDraftContent): string[] {
  const fromKeywords = profile.problemsAndTriggers.keywords.slice(0, 4)
  const fromProducts = profile.company.productsServices.slice(0, 2)
  const fromIndustries = profile.idealCustomers.targetIndustries.slice(0, 2)
  const merged = [...fromKeywords, ...fromProducts, ...fromIndustries]
    .map((value) => value.trim())
    .filter(Boolean)
  return Array.from(new Set(merged)).slice(0, 5)
}

export function projectApprovedBusinessProfileToLeadDiscovery(
  profile: BusinessProfileDraftContent,
  companyName?: string | null,
): BusinessProfileLeadDiscoveryProjection {
  const topics = buildTopics(profile)
  const jobTitles = profile.idealCustomers.buyerPersonas.map(normalizeJobTitle).filter(Boolean)
  const geography = parseGeographyFromProfile(profile.idealCustomers.geography)

  return {
    topics,
    industries: profile.idealCustomers.targetIndustries,
    jobTitles: jobTitles.length > 0 ? jobTitles : ["owner", "operations manager"],
    geography,
    companySize: mapCompanySizeRanges(profile.idealCustomers.companySizeRanges),
    keywords: profile.problemsAndTriggers.keywords,
    negativeKeywords: profile.problemsAndTriggers.negativeKeywords,
    buyerPersonas: profile.idealCustomers.buyerPersonas,
    intentLevels: ["high", "medium"],
    lookbackDays: 7,
    assumptions: [
      "Started from your approved Business Profile.",
      `Target industries: ${profile.idealCustomers.targetIndustries.slice(0, 3).join(", ") || "see profile"}.`,
      `Buyer personas: ${profile.idealCustomers.buyerPersonas.slice(0, 4).join(", ") || "see profile"}.`,
    ],
    audienceNameSuggestion: companyName
      ? `${companyName} lead discovery audience`
      : `${topics[0] ?? "Lead discovery"} audience`,
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
