import {
  PROSPECT_SEARCH_DECISION_ROLES,
  PROSPECT_SEARCH_INDUSTRIES,
  PROSPECT_SEARCH_LOCATIONS,
  PROSPECT_SEARCH_TECHNOLOGIES,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"

export type ProspectSearchRecommendation = {
  id: string
  label: string
  value: string
  group: "industry" | "location" | "technology" | "role" | "intent" | "size"
  score: number
}

const INDUSTRY_ALIASES: Record<string, string[]> = {
  medical: [
    "Medical Equipment Service",
    "Medical Device Repair",
    "Biomedical",
    "Healthcare Field Service",
  ],
  biomedical: ["Biomedical", "Medical Device Repair", "Healthcare Field Service"],
  hvac: ["HVAC", "Field Service", "Commercial Equipment"],
  electrical: ["Electrical", "MEP", "Commercial Equipment"],
  field: ["Field Service", "Commercial Equipment"],
  service: ["Field Service", "Medical Equipment Service"],
  owner: ["Owner", "Founder", "President", "CEO"],
  founder: ["Founder", "Owner", "President"],
  president: ["President", "CEO", "Owner"],
  director: ["Service Director", "Field Service Director", "Operations Manager"],
  salesforce: ["Salesforce"],
  hubspot: ["HubSpot"],
  quickbooks: ["QuickBooks"],
  servicetitan: ["ServiceTitan"],
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function scoreMatch(needle: string, hay: string): number {
  const n = norm(needle)
  const h = norm(hay)
  if (!n || !h) return 0
  if (h === n) return 1
  if (h.startsWith(n)) return 0.9
  if (h.includes(n)) return 0.75
  return 0
}

export function buildFilterRecommendations(input: {
  field: "industry" | "location" | "technology" | "role"
  query: string
  limit?: number
}): ProspectSearchRecommendation[] {
  const needle = norm(input.query)
  const limit = input.limit ?? 8
  if (!needle) return []

  const pool: ProspectSearchRecommendation[] = []

  const aliasHits = INDUSTRY_ALIASES[needle] ?? []
  for (const label of aliasHits) {
    pool.push({
      id: `alias-${label}`,
      label,
      value: label,
      group: input.field === "role" ? "role" : input.field,
      score: 0.95,
    })
  }

  const lists: Record<typeof input.field, readonly string[]> = {
    industry: PROSPECT_SEARCH_INDUSTRIES,
    location: PROSPECT_SEARCH_LOCATIONS,
    technology: PROSPECT_SEARCH_TECHNOLOGIES,
    role: PROSPECT_SEARCH_DECISION_ROLES,
  }

  for (const item of lists[input.field]) {
    const sc = scoreMatch(needle, item)
    if (sc > 0.3)
      pool.push({
        id: `${input.field}-${item}`,
        label: item,
        value: item,
        group: input.field,
        score: sc,
      })
  }

  if (input.field === "industry" && needle.length >= 3) {
    for (const [key, labels] of Object.entries(INDUSTRY_ALIASES)) {
      if (key.includes(needle) || needle.includes(key)) {
        for (const label of labels) {
          pool.push({
            id: `partial-${label}`,
            label,
            value: label,
            group: "industry",
            score: 0.7,
          })
        }
      }
    }
  }

  const seen = new Set<string>()
  return pool
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seen.has(r.value)) return false
      seen.add(r.value)
      return true
    })
    .slice(0, limit)
}
