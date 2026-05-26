import type { GrowthExternalCompanyCandidate } from "@/lib/growth/external-discovery/external-discovery-types"

function textMatchScore(query: string, blob: string): number {
  const q = query.trim().toLowerCase()
  const b = blob.toLowerCase()
  if (!q || !b) return 0
  if (b.includes(q)) return 0.85
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const hits = tokens.filter((t) => b.includes(t)).length
  return hits / tokens.length
}

export function rankExternalCompanyCandidates(
  candidates: GrowthExternalCompanyCandidate[],
  query: string,
  industry: string | null,
  location: string | null,
  limit = 50,
): Array<GrowthExternalCompanyCandidate & { rank_score: number }> {
  const industryHint = (industry ?? "").trim().toLowerCase()
  const locationHint = (location ?? "").trim().toLowerCase()

  const scored = candidates.map((row) => {
    const blob = [
      row.company_name,
      row.website,
      row.industry,
      row.location,
      row.city,
      row.state,
      row.category,
    ]
      .filter(Boolean)
      .join(" ")

    let rank = textMatchScore(query, blob)
    if (industryHint) rank += textMatchScore(industryHint, blob) * 0.35
    if (locationHint) rank += textMatchScore(locationHint, blob) * 0.35
    rank += row.confidence * 0.2
    if (row.rating != null) rank += Math.min(0.08, row.rating / 50)
    if (row.existing_customer_match || row.existing_prospect_match) rank -= 0.15
    if (row.existing_growth_lead_match) rank -= 0.05

    return { ...row, rank_score: Number(rank.toFixed(4)) }
  })

  return scored.sort((a, b) => b.rank_score - a.rank_score).slice(0, limit)
}
