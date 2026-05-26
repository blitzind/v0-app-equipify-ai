import type { GrowthRealWorldCompanyCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

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

export function rankRealWorldCompanyCandidates(
  candidates: GrowthRealWorldCompanyCandidate[],
  query: string,
  inputs: GrowthRealWorldDiscoverySearchInputs,
  limit = 50,
): Array<GrowthRealWorldCompanyCandidate & { rank_score: number }> {
  const industryHint = (inputs.subindustry ?? inputs.industry ?? "").trim().toLowerCase()
  const locationHint = (inputs.location ?? "").trim().toLowerCase()
  const keywordHints = (inputs.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean)

  const scored = candidates.map((row) => {
    const blob = [
      row.company_name,
      row.website,
      row.industry,
      row.location,
      row.city,
      row.state,
      row.category,
      row.description,
    ]
      .filter(Boolean)
      .join(" ")

    let rank = textMatchScore(query, blob)
    if (industryHint) rank += textMatchScore(industryHint, blob) * 0.35
    if (locationHint) rank += textMatchScore(locationHint, blob) * 0.35
    for (const kw of keywordHints.slice(0, 5)) {
      rank += textMatchScore(kw, blob) * 0.12
    }
    rank += row.confidence * 0.2
    if (row.rating != null) rank += Math.min(0.08, row.rating / 50)
    if (typeof row.source_rank === "number") rank += Math.max(0, 0.05 - row.source_rank * 0.005)
    if (row.existing_customer_match || row.existing_prospect_match) rank -= 0.15
    if (row.existing_growth_lead_match) rank -= 0.05

    return { ...row, rank_score: Number(rank.toFixed(4)) }
  })

  return scored.sort((a, b) => b.rank_score - a.rank_score).slice(0, limit)
}
