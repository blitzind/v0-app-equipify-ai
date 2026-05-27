/** Observed company fields for signal detectors — no invented data. */

export type GrowthCompanySignalContext = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  website: string | null
  industry: string | null
  category: string | null
  description: string | null
  location: string | null
  city: string | null
  state: string | null
  country: string | null
  review_count: number | null
  rating: number | null
  /** From enrichment internal_growth — observed tier only */
  observed_technology_signals: string[]
  observed_crm_signals: string[]
  observed_service_signals: string[]
  metadata: Record<string, unknown>
}

export function companySignalContextBlob(ctx: GrowthCompanySignalContext): string {
  return [
    ctx.company_name,
    ctx.industry,
    ctx.category,
    ctx.description,
    ctx.location,
    ctx.city,
    ctx.state,
    ...ctx.observed_technology_signals,
    ...ctx.observed_crm_signals,
    ...ctx.observed_service_signals,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function matchPhrase(
  blob: string,
  phrases: Array<{ phrase: string; strength?: "strong" | "moderate" | "weak" }>,
): { phrase: string; strength: "strong" | "moderate" | "weak" } | null {
  for (const p of phrases) {
    if (blob.includes(p.phrase.toLowerCase())) {
      return { phrase: p.phrase, strength: p.strength ?? "moderate" }
    }
  }
  return null
}
