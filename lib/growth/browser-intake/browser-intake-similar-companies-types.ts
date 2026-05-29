/** Browser extension similar company discovery — client-safe. */

export const GROWTH_BROWSER_INTAKE_SIMILAR_COMPANIES_QA_MARKER =
  "growth-browser-intake-similar-companies-v1" as const

export type GrowthBrowserIntakeSimilarCompanyMatch = {
  company_name: string
  website: string | null
  location: string | null
  confidence: number
  why_matched: string
  lead_id: string | null
  relationship_type: string | null
}

export type GrowthBrowserIntakeSimilarCompaniesSeed = {
  lead_id: string | null
  company_name: string
  website: string | null
  industry: string | null
  state: string | null
  city: string | null
}

export type GrowthBrowserIntakeSimilarCompaniesResult = {
  seed: GrowthBrowserIntakeSimilarCompaniesSeed
  matches: GrowthBrowserIntakeSimilarCompanyMatch[]
}

export function formatBrowserIntakeSimilarCompanyLocation(input: {
  city?: string | null
  state?: string | null
}): string | null {
  const city = (input.city ?? "").trim()
  const state = (input.state ?? "").trim()
  if (city && state) return `${city}, ${state}`
  if (state) return state
  if (city) return city
  return null
}

export function mapBrowserIntakeRelationshipToSimilarCompany(input: {
  related_company_name: string
  relationship_strength: number
  evidence_excerpt: string
  relationship_type: string
  website?: string | null
  city?: string | null
  state?: string | null
  lead_id?: string | null
}): GrowthBrowserIntakeSimilarCompanyMatch {
  return {
    company_name: input.related_company_name,
    website: input.website ?? null,
    location: formatBrowserIntakeSimilarCompanyLocation({
      city: input.city,
      state: input.state,
    }),
    confidence: Math.round(input.relationship_strength),
    why_matched: input.evidence_excerpt,
    lead_id: input.lead_id ?? null,
    relationship_type: input.relationship_type,
  }
}
